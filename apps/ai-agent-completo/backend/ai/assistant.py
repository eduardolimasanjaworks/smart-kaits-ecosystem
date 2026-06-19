"""
ai/assistant.py - Ponto de Entrada da Conversa

Atende requisições do frontend, roda o RAG (se precisar), monta o System Prompt,
e aciona a OpenAI.
"""

import httpx
import json
import re
import unicodedata
from ai.client import openai_client
from ai.config import CHAT_MODEL
from ai.retriever import search_knowledge
from ai.prompt_builder import build_assistant_system_prompt

KAITS_BASE_URL = "https://api.kaits.com.br"
MAX_RESULTS_DEFAULT = 10  # Limite padrão de resultados
MAX_JSON_LENGTH = 5000    # Limite de caracteres para a resposta JSON


def normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def extract_lookup_name(user_message: str, entity: str) -> str:
    message = (user_message or "").strip()
    patterns = {
        "curso": [
            r"curso\s+(.+?)(?=\s+no\s+est[aá]gio\b|\s+no\s+n[ií]vel\b|\?|,|$)",
        ],
        "estagio": [
            r"est[aá]gio\s+(.+?)(?=\s+da\s+turma\b|\?|,|$)",
            r"n[ií]vel\s+(.+?)(?=\s+da\s+turma\b|\?|,|$)",
        ],
        "turma": [
            r"turma\s+(.+?)(?:\?|,|$)",
        ],
    }
    for pattern in patterns.get(entity, []):
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1).strip(" \"'.")
    return ""


def find_best_named_match(items: list[dict], query: str, candidate_keys: list[str]) -> dict | None:
    normalized_query = normalize_text(query)
    if not normalized_query:
        return None

    exact_matches = []
    contains_matches = []
    token_matches = []

    query_tokens = [token for token in normalized_query.split(" ") if token]
    for item in items or []:
        candidates = [
            normalize_text(item.get(key, ""))
            for key in candidate_keys
            if item.get(key)
        ]
        candidates = [candidate for candidate in candidates if candidate]
        if not candidates:
            continue

        if normalized_query in candidates:
            exact_matches.append(item)
            continue

        if any(normalized_query in candidate for candidate in candidates):
            contains_matches.append(item)
            continue

        if query_tokens and any(all(token in candidate for token in query_tokens) for candidate in candidates):
            token_matches.append(item)

    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(contains_matches) == 1:
        return contains_matches[0]
    if len(token_matches) == 1:
        return token_matches[0]
    return None


def narrow_student_results(api_result: dict, args: dict) -> dict:
    alunos = api_result.get("alunos") or []
    if not alunos:
        return api_result

    exact_matches = alunos

    cpf = (args.get("CPF") or "").strip()
    if cpf:
        clean_cpf = re.sub(r"\D", "", cpf)
        filtered = [
            aluno for aluno in exact_matches
            if re.sub(r"\D", "", str(aluno.get("CPF", ""))) == clean_cpf
        ]
        if filtered:
            return {**api_result, "alunos": filtered}

    matricula = str(args.get("numMatric") or "").strip()
    if matricula:
        filtered = [
            aluno for aluno in exact_matches
            if str(aluno.get("matricula", "")).strip() == matricula
            or str(aluno.get("numMatric", "")).strip() == matricula
        ]
        if filtered:
            return {**api_result, "alunos": filtered}

    email = normalize_text(args.get("email", ""))
    if email:
        filtered = [
            aluno for aluno in exact_matches
            if email and email in normalize_text(aluno.get("emails", ""))
        ]
        if filtered:
            return {**api_result, "alunos": filtered}

    rg = normalize_text(args.get("RG", ""))
    if rg:
        filtered = [
            aluno for aluno in exact_matches
            if rg == normalize_text(aluno.get("RG", ""))
        ]
        if filtered:
            return {**api_result, "alunos": filtered}

    nome = normalize_text(args.get("nome", ""))
    if nome:
        exact_name_matches = [
            aluno for aluno in exact_matches
            if normalize_text(aluno.get("nome", "")) == nome
        ]
        if exact_name_matches:
            return {**api_result, "alunos": exact_name_matches}

        if len(nome.split()) >= 2:
            contained_name_matches = [
                aluno for aluno in exact_matches
                if nome in normalize_text(aluno.get("nome", ""))
            ]
            if 0 < len(contained_name_matches) <= 5:
                return {**api_result, "alunos": contained_name_matches}

    return api_result


def infer_document_lookup_args(user_message: str, args: dict) -> dict:
    fixed_args = dict(args or {})
    message = user_message or ""

    if fixed_args.get("idAluno") or fixed_args.get("idMatric"):
        return fixed_args

    aluno_id_match = re.search(r"(?:id\s*(?:do|de)?\s*aluno|aluno\s+de\s+id|aluno\s+id)\D*(\d+)", message, re.IGNORECASE)
    matric_id_match = re.search(r"(?:id\s*(?:da|de)?\s*matr[ií]cula|matr[ií]cula\s+de\s+id|matr[ií]cula\s+id)\D*(\d+)", message, re.IGNORECASE)
    matric_num_match = re.search(r"matr[ií]cula\D*(\d+)", message, re.IGNORECASE)

    if aluno_id_match:
        fixed_args["idAluno"] = aluno_id_match.group(1)
        fixed_args.pop("numMatric", None)
        return fixed_args

    if matric_id_match:
        fixed_args["idMatric"] = matric_id_match.group(1)
        fixed_args.pop("numMatric", None)
        return fixed_args

    if matric_num_match and not fixed_args.get("numMatric"):
        fixed_args["numMatric"] = matric_num_match.group(1)

    return fixed_args


def infer_financial_lookup_args(user_message: str, args: dict) -> dict:
    fixed_args = dict(args or {})
    message = user_message or ""
    normalized_message = normalize_text(message)

    aluno_id_match = re.search(r"(?:id\s*(?:do|de)?\s*aluno|aluno\s+de\s+id|aluno\s+id)\D*(\d+)", message, re.IGNORECASE)
    matric_id_match = re.search(r"(?:id\s*(?:da|de)?\s*matr[ií]cula|matr[ií]cula\s+de\s+id|matr[ií]cula\s+id)\D*(\d+)", message, re.IGNORECASE)
    matric_num_match = re.search(r"matr[ií]cula\D*(\d+)", message, re.IGNORECASE)
    cat_id_match = re.search(r"categoria\D*(\d+)", message, re.IGNORECASE)

    # Se o modelo colocou o número da matrícula em idMatric sem o usuário ter dito "ID",
    # tratamos como número da matrícula e resolvemos depois para o ID interno correto.
    if fixed_args.get("idMatric") and not fixed_args.get("numMatric"):
        mentions_matric_id = bool(matric_id_match)
        mentions_generic_matric = "matricula" in normalized_message
        if mentions_generic_matric and not mentions_matric_id:
            fixed_args["numMatric"] = str(fixed_args["idMatric"])
            fixed_args.pop("idMatric", None)

    if aluno_id_match and not fixed_args.get("idAluno"):
        fixed_args["idAluno"] = aluno_id_match.group(1)

    if matric_id_match and not fixed_args.get("idMatric"):
        fixed_args["idMatric"] = matric_id_match.group(1)

    if matric_num_match and not fixed_args.get("numMatric") and not fixed_args.get("idMatric"):
        fixed_args["numMatric"] = matric_num_match.group(1)

    if cat_id_match and not fixed_args.get("idCat"):
        fixed_args["idCat"] = cat_id_match.group(1)

    return fixed_args


async def resolve_enrollment_identifiers(kaits_token: str, args: dict) -> dict:
    fixed_args = dict(args or {})
    num_matric = str(fixed_args.get("numMatric") or "").strip()
    if not num_matric or fixed_args.get("idMatric"):
        return fixed_args

    matricula_lookup = await call_kaits_api(
        kaits_token,
        endpoint="matriculas",
        action="moviment",
        params={"numMatric": num_matric},
    )
    if matricula_lookup.get("sucesso") != "1":
        return fixed_args

    matriculas_exatas = [
        matricula for matricula in (matricula_lookup.get("matriculas") or [])
        if str(matricula.get("numMatric", "")).strip() == num_matric
    ]
    if len(matriculas_exatas) == 1:
        if matriculas_exatas[0].get("idMatric"):
            fixed_args["idMatric"] = str(matriculas_exatas[0]["idMatric"])
        if matriculas_exatas[0].get("idAlun") and not fixed_args.get("idAluno"):
            fixed_args["idAluno"] = str(matriculas_exatas[0]["idAlun"])
    return fixed_args


async def resolve_program_lookup_args(kaits_token: str, user_message: str, args: dict) -> tuple[dict, str | None]:
    fixed_args, resolution_hint = await resolve_course_stage_class_args(
        kaits_token,
        user_message,
        args,
        require_stage=True,
        require_class=False,
    )
    if resolution_hint:
        return fixed_args, resolution_hint
    if not fixed_args.get("idCurs"):
        return fixed_args, "Para consultar o programa, preciso identificar pelo menos o curso."
    return fixed_args, None


async def resolve_course_stage_class_args(
    kaits_token: str,
    user_message: str,
    args: dict,
    *,
    require_stage: bool = False,
    require_class: bool = False,
) -> tuple[dict, str | None]:
    fixed_args = dict(args or {})
    course_name = (
        fixed_args.get("curso_nome")
        or fixed_args.get("course_name")
        or fixed_args.get("nomeCurso")
        or extract_lookup_name(user_message, "curso")
    )
    stage_name = (
        fixed_args.get("estagio_nome")
        or fixed_args.get("stage_name")
        or fixed_args.get("nomeEstagio")
        or extract_lookup_name(user_message, "estagio")
    )
    class_name = (
        fixed_args.get("turma_nome")
        or fixed_args.get("class_name")
        or fixed_args.get("nomeTurma")
        or extract_lookup_name(user_message, "turma")
    )

    if course_name and not fixed_args.get("curso_nome"):
        fixed_args["curso_nome"] = course_name
    if stage_name and not fixed_args.get("estagio_nome"):
        fixed_args["estagio_nome"] = stage_name
    if class_name and not fixed_args.get("turma_nome"):
        fixed_args["turma_nome"] = class_name

    all_data = None
    needs_global_lookup = bool(course_name or stage_name or class_name)
    if needs_global_lookup:
        all_data = await call_kaits_api(kaits_token, endpoint="cursos", action="tudosepara")
        if all_data.get("sucesso") != "1":
            all_data = None
        else:
            separated_list = all_data.get("lista separada", {})
            all_data = {
                "cursos": ((separated_list.get("cursos") or {}).get("cursos") or []),
                "estagios": ((separated_list.get("estagios") or {}).get("estagios") or []),
                "turmas": ((separated_list.get("turmas") or {}).get("turmas") or []),
            }

    if all_data:
        if fixed_args.get("idCurs") and not any(
            str(curso.get("idCurs")) == str(fixed_args.get("idCurs"))
            for curso in (all_data.get("cursos") or [])
        ):
            fixed_args.pop("idCurs", None)
        if fixed_args.get("idEst") and not any(
            str(estagio.get("idEst")) == str(fixed_args.get("idEst"))
            for estagio in (all_data.get("estagios") or [])
        ):
            fixed_args.pop("idEst", None)
        if fixed_args.get("idTurm") and not any(
            str(turma.get("idTurm")) == str(fixed_args.get("idTurm"))
            for turma in (all_data.get("turmas") or [])
        ):
            fixed_args.pop("idTurm", None)

    if not fixed_args.get("idCurs") and course_name and all_data:
        matched_course = find_best_named_match(
            all_data.get("cursos", []),
            course_name,
            ["nome", "abrev"],
        )
        if matched_course and matched_course.get("idCurs"):
            fixed_args["idCurs"] = str(matched_course["idCurs"])

    if not fixed_args.get("idEst"):
        if fixed_args.get("idCurs"):
            estagios_result = await call_kaits_api(
                kaits_token,
                endpoint="cursos",
                action="estagio",
                params={"idCurs": fixed_args["idCurs"]},
            )
            if estagios_result.get("sucesso") == "1":
                estagios = estagios_result.get("estagios") or []
                if stage_name:
                    matched_stage = find_best_named_match(
                        estagios,
                        stage_name,
                        ["nome", "abrev", "obs"],
                    )
                    if matched_stage and matched_stage.get("idEst"):
                        fixed_args["idEst"] = str(matched_stage["idEst"])
                elif len(estagios) == 1 and estagios[0].get("idEst"):
                    fixed_args["idEst"] = str(estagios[0]["idEst"])
        elif stage_name and all_data:
            matched_stage = find_best_named_match(
                all_data.get("estagios", []),
                stage_name,
                ["nome", "abrev", "obs"],
            )
            if matched_stage and matched_stage.get("idEst"):
                fixed_args["idEst"] = str(matched_stage["idEst"])

    if not fixed_args.get("idTurm"):
        if fixed_args.get("idEst"):
            turmas_result = await call_kaits_api(
                kaits_token,
                endpoint="cursos",
                action="turma",
                params={"idEst": fixed_args["idEst"]},
            )
            if turmas_result.get("sucesso") == "1":
                turmas = turmas_result.get("turmas") or []
                if class_name:
                    matched_class = find_best_named_match(
                        turmas,
                        class_name,
                        ["nome", "turma"],
                    )
                    if matched_class and matched_class.get("idTurm"):
                        fixed_args["idTurm"] = str(matched_class["idTurm"])
                elif require_class and len(turmas) == 1 and turmas[0].get("idTurm"):
                    fixed_args["idTurm"] = str(turmas[0]["idTurm"])
        elif class_name and all_data:
            matched_class = find_best_named_match(
                all_data.get("turmas", []),
                class_name,
                ["nome", "turma"],
            )
            if matched_class and matched_class.get("idTurm"):
                fixed_args["idTurm"] = str(matched_class["idTurm"])
                if matched_class.get("idEst") and not fixed_args.get("idEst"):
                    fixed_args["idEst"] = str(matched_class["idEst"])

    if require_stage and not fixed_args.get("idEst"):
        if fixed_args.get("idCurs"):
            return fixed_args, "Não consegui identificar o estágio desse curso. Você pode me dizer o nome do estágio ou o ID do estágio?"
        return fixed_args, "Para seguir com essa consulta, preciso saber qual curso ou estágio você quer usar."

    if require_class and not fixed_args.get("idTurm"):
        if fixed_args.get("idEst"):
            return fixed_args, "Não consegui identificar a turma exata. Você pode me informar o nome da turma ou o ID da turma?"
        return fixed_args, "Para essa consulta, preciso identificar a turma. Você pode informar o nome da turma, o curso ou o estágio?"

    return fixed_args, None


async def call_kaits_api(
    kaits_token: str,
    endpoint: str,
    action: str,
    params: dict = None,
) -> dict:
    """
    Helper function to call KAITS API endpoints.
    
    Args:
        kaits_token: The KAITS API token
        endpoint: The endpoint to call (e.g., "alunos", "aulas", "cursos")
        action: The action to perform (e.g., "alunos", "turmas", "valores")
        params: Additional parameters for the request
    
    Returns:
        The API response
    """
    url = f"{KAITS_BASE_URL}/{endpoint}/"
    payload = {
        "token": kaits_token,
        "acao": action
    }
    
    if params:
        payload.update(params)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            
            # Verifica se a resposta foi bem-sucedida
            if result.get("sucesso") == "1":
                return result
            else:
                return {
                    "sucesso": "0",
                    "msg": result.get("msg", "Erro desconhecido na API do KAITS")
                }
    except httpx.HTTPStatusError as e:
        return {"sucesso": "0", "msg": f"Erro HTTP na API: {e.response.status_code}"}
    except httpx.TimeoutException:
        return {"sucesso": "0", "msg": "Tempo esgotado na API do KAITS"}
    except Exception as e:
        return {"sucesso": "0", "msg": str(e)}


def format_kaits_response(api_result: dict) -> str:
    """
    Formata a resposta do KAITS para o usuário final.
    Se a resposta for muito longa, resumindo os pontos principais.
    """
    if not api_result:
        return "Nenhum dado encontrado."
    
    formatted_text = []
    
    if "tudosepara" in api_result:
        ts = api_result["tudosepara"]
        ts_cursos = ts.get("cursos", [])
        ts_estagios = ts.get("estagios", [])
        ts_turmas = ts.get("turmas", [])
        
        formatted_text.append(f"Encontrei:")
        if ts_cursos:
            formatted_text.append(f"• {len(ts_cursos)} curso(s)")
        if ts_estagios:
            formatted_text.append(f"• {len(ts_estagios)} estágio(s)")
        if ts_turmas:
            formatted_text.append(f"• {len(ts_turmas)} turma(s)")
        
        # Adiciona detalhes se a lista não for muito longa
        if ts_turmas and len(ts_turmas) <= 5:
            formatted_text.append("\nTurmas disponíveis:")
            for turma in ts_turmas[:5]:
                turma_str = "  - "
                turma_nome = turma.get("turma") or turma.get("nome") or ""
                turma_str += turma_nome
                if turma.get("curso"):
                    turma_str += f" {turma.get('curso')}"
                if turma.get("estagio"):
                    turma_str += f" - {turma.get('estagio')}"
                if turma.get("idTurm"):
                    turma_str += f" (ID: {turma.get('idTurm')})"
                formatted_text.append(turma_str)
    
    if "aulasTurma" in api_result:
        aulas = api_result["aulasTurma"].get("aulas", [])
        formatted_text.append(f"\nAulas encontradas: {len(aulas)}")
        for aula in aulas[:5]:
            aula_str = "  - "
            if aula.get("nome"):
                aula_str += aula.get("nome")
            if aula.get("data"):
                aula_str += f" ({aula.get('data')}"
            if aula.get("hora"):
                aula_str += f" às {aula.get('hora')}"
            aula_str += ")"
            formatted_text.append(aula_str)
        if len(aulas) > 5:
            formatted_text.append(f"  ... e mais {len(aulas) - 5} aulas")
    
    if "alunos" in api_result:
        alunos = api_result["alunos"]
        formatted_text.append(f"\nAlunos encontrados: {len(alunos)}")
        for aluno in alunos[:5]:
            aluno_str = "  - "
            if aluno.get("nome"):
                aluno_str += aluno.get("nome")
            if aluno.get("matricula"):
                aluno_str += f" (Matrícula: {aluno.get('matricula')})"
            formatted_text.append(aluno_str)
        if len(alunos) > 5:
            formatted_text.append(f"  ... e mais {len(alunos) - 5} alunos")
    
    if "valores" in api_result:
        valores = api_result["valores"]
        formatted_text.append("\nValores encontrados:")
        if isinstance(valores, list):
            for valor in valores[:5]:
                partes = [valor.get("nome", "Taxa")]
                if valor.get("tipo"):
                    partes.append(f"tipo {valor.get('tipo')}")
                if valor.get("valor"):
                    partes.append(f"R$ {valor.get('valor')}")
                if valor.get("vezes"):
                    partes.append(f"{valor.get('vezes')}x")
                formatted_text.append("  - " + " | ".join(partes))
        elif isinstance(valores, dict):
            if valores.get("taxasMatricula"):
                formatted_text.append("  Taxas de matrícula:")
                for taxa in valores["taxasMatricula"][:3]:
                    taxa_str = f"    - {taxa.get('nome', '')}: R$ {taxa.get('valor', '')}"
                    formatted_text.append(taxa_str)
            if valores.get("valores"):
                formatted_text.append("  Valores do curso:")
                for valor in valores["valores"][:3]:
                    valor_str = f"    - {valor.get('nome', '')}: R$ {valor.get('valor', '')}"
                    formatted_text.append(valor_str)

    if "cursos" in api_result:
        cursos = api_result["cursos"]
        formatted_text.append(f"\nCursos encontrados: {len(cursos)}")
        for curso in cursos[:5]:
            curso_str = f"  - {curso.get('nome', 'Curso')}"
            if curso.get("abrev"):
                curso_str += f" ({curso.get('abrev')})"
            if curso.get("modalidade"):
                curso_str += f" - modalidade: {curso.get('modalidade')}"
            formatted_text.append(curso_str)

    if "estagios" in api_result:
        estagios = api_result["estagios"]
        formatted_text.append(f"\nEstágios ou níveis encontrados: {len(estagios)}")
        for estagio in estagios[:5]:
            estagio_nome = (
                estagio.get("nome")
                or estagio.get("abrev")
                or estagio.get("obs")
                or f"Estágio {estagio.get('idEst', '')}".strip()
            )
            estagio_str = f"  - {estagio_nome}"
            if estagio.get("abrev"):
                estagio_str += f" ({estagio.get('abrev')})"
            formatted_text.append(estagio_str)

    if "turmas" in api_result:
        turmas = api_result["turmas"]
        formatted_text.append(f"\nTurmas encontradas: {len(turmas)}")
        for turma in turmas[:5]:
            turma_str = f"  - {turma.get('nome', 'Turma')}"
            if turma.get("ini") or turma.get("fim"):
                turma_str += f" | período: {turma.get('ini', '?')} a {turma.get('fim', '?')}"
            if turma.get("ocupacao") is not None:
                turma_str += f" | ocupação: {turma.get('ocupacao')}"
            formatted_text.append(turma_str)

    if "aulas" in api_result:
        aulas = api_result["aulas"]
        formatted_text.append(f"\nAulas encontradas: {len(aulas)}")
        for aula in aulas[:5]:
            aula_nome = aula.get("nome") or "Aula"
            aula_str = f"  - {aula_nome}"
            if aula.get("data"):
                aula_str += f" | data: {aula.get('data')}"
            if aula.get("hora"):
                aula_str += f" | hora: {aula.get('hora')}"
            if aula.get("profNome"):
                aula_str += f" | professor: {aula.get('profNome')}"
            if aula.get("salaNome"):
                aula_str += f" | sala: {aula.get('salaNome')}"
            if aula.get("status"):
                aula_str += f" | status: {aula.get('status')}"
            formatted_text.append(aula_str)

    if "programa" in api_result:
        programa = api_result["programa"]
        formatted_text.append(f"\nPrograma encontrado: {len(programa)} tópico(s)")
        for topico in programa[:5]:
            topico_str = f"  - {topico.get('titulo', 'Tópico')}"
            if topico.get("conteudo"):
                topico_str += f": {topico.get('conteudo')}"
            formatted_text.append(topico_str)

    if "prof" in api_result:
        profs = api_result["prof"]
        formatted_text.append(f"\nProfessores encontrados: {len(profs)}")
        for prof in profs[:5]:
            prof_str = f"  - {prof.get('nome', 'Professor')}"
            if prof.get("emails"):
                prof_str += f" | e-mail(s): {prof.get('emails')}"
            formatted_text.append(prof_str)

    if "documentos" in api_result:
        documentos = api_result["documentos"]
        formatted_text.append(f"\nDocumentos encontrados: {len(documentos)}")
        for doc in documentos[:5]:
            doc_str = f"  - {doc.get('nomeDoc', 'Documento')}"
            if doc.get("aluno"):
                doc_str += f" | aluno: {doc.get('aluno')}"
            if doc.get("emissao"):
                doc_str += f" | emissão: {doc.get('emissao')}"
            formatted_text.append(doc_str)

    if "aluno" in api_result:
        aluno = api_result["aluno"]
        formatted_text.append("\nFicha do aluno:")
        formatted_text.append(f"  - Nome: {aluno.get('nome', 'Não informado')}")
        if aluno.get("registro"):
            formatted_text.append(f"  - Registro: {aluno.get('registro')}")
        if aluno.get("perfil"):
            formatted_text.append(f"  - Perfil: {aluno.get('perfil')}")
        responsaveis = aluno.get("responsaveis", [])
        if responsaveis:
            nomes = ", ".join([r.get("nome", "") for r in responsaveis[:3] if r.get("nome")])
            if nomes:
                formatted_text.append(f"  - Responsáveis: {nomes}")

    if "pagtos" in api_result:
        pagtos = api_result["pagtos"]
        formatted_text.append(f"\nLançamentos financeiros encontrados: {len(pagtos)}")
        for pagto in pagtos[:5]:
            pagto_str = f"  - {pagto.get('descricao', 'Pagamento')}"
            if pagto.get("status"):
                pagto_str += f" | status: {pagto.get('status')}"
            if pagto.get("valor"):
                pagto_str += f" | valor: {pagto.get('valor')}"
            if pagto.get("vencimento"):
                pagto_str += f" | vence em: {pagto.get('vencimento')}"
            formatted_text.append(pagto_str)

    if "matriculas" in api_result:
        matriculas = api_result["matriculas"]
        formatted_text.append(f"\nAlunos ou matrículas encontradas: {len(matriculas)}")
        for matricula in matriculas[:5]:
            matricula_str = f"  - {matricula.get('aluno', 'Aluno')}"
            if matricula.get("numMatric"):
                matricula_str += f" | matrícula: {matricula.get('numMatric')}"
            if matricula.get("turma"):
                matricula_str += f" | turma: {matricula.get('turma')}"
            formatted_text.append(matricula_str)

    if "nome" in api_result and "data" in api_result and "hora" in api_result and "aulas" not in api_result:
        formatted_text.append("\nDetalhes da aula:")
        formatted_text.append(f"  - Aula: {api_result.get('nome')}")
        formatted_text.append(f"  - Data: {api_result.get('data')}")
        formatted_text.append(f"  - Hora: {api_result.get('hora')}")
        if api_result.get("turmaNome"):
            formatted_text.append(f"  - Turma: {api_result.get('turmaNome')}")
        if api_result.get("profNome"):
            formatted_text.append(f"  - Professor(es): {api_result.get('profNome')}")
    
    return "\n".join(formatted_text) if formatted_text else json.dumps(api_result, ensure_ascii=False)


async def personalize_tool_response(
    user_message: str,
    tool_name: str,
    formatted_data: str,
    response_instructions: str,
) -> str:
    """
    Reescreve a saída da consulta em linguagem natural seguindo instruções opcionais.
    Usa apenas os dados confirmados pela ferramenta.
    """
    default_text = f"Consultei o sistema KAITS:\n{formatted_data}"
    if not response_instructions:
        return default_text

    try:
        response = await openai_client.chat.completions.create(
            model=CHAT_MODEL,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você transforma resultados confirmados de uma consulta do sistema escolar em uma resposta final para o usuário.\n"
                        "Regras:\n"
                        "- Use apenas os dados fornecidos.\n"
                        "- Não invente, complete ou assuma nada além do que foi consultado.\n"
                        "- Responda no mesmo idioma do usuário.\n"
                        "- Siga a orientação de estilo recebida, sem mencionar instruções internas.\n"
                        "- Se não houver resultados úteis, diga isso com clareza e naturalidade."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Pergunta do usuário:\n{user_message}\n\n"
                        f"Ferramenta usada:\n{tool_name}\n\n"
                        f"Como devo responder:\n{response_instructions}\n\n"
                        f"Dados confirmados pela consulta:\n{formatted_data}"
                    ),
                },
            ],
        )
        final_text = (response.choices[0].message.content or "").strip()
        return final_text or default_text
    except Exception:
        return default_text


async def build_tool_success_response(
    *,
    tool_key: str,
    tool_name: str,
    api_result: dict,
    audit_headline: str,
    args: dict,
    agent_config: dict,
    user_message: str,
) -> dict:
    tools_config = agent_config.get("tools", {})
    response_instructions = (tools_config.get(f"{tool_key}ResponseInstructions", "") or "").strip()
    formatted_text = format_kaits_response(api_result)
    final_text = await personalize_tool_response(
        user_message=user_message,
        tool_name=tool_name,
        formatted_data=formatted_text,
        response_instructions=response_instructions,
    )
    return {
        "text": final_text,
        "audit": {"type": "tool", "headline": audit_headline, "detail": args},
    }


def check_tool_access(tool_key: str, user_identifier: str, agent_config: dict) -> bool:
    """
    Verifica DE FORMA DETERMINÍSTICA se o usuário tem permissão para usar a ferramenta.
    Retorna True se permitido, False se bloqueado.
    """
    tools_config = agent_config.get("tools", {})
    governance_mode = tools_config.get(f"{tool_key}GovernanceMode", "allow")
    allowed_contacts = tools_config.get(f"{tool_key}AllowedContacts", [])
    blocked_contacts = tools_config.get(f"{tool_key}BlockedContacts", [])

    # Se não temos identificador do usuário, permite por padrão
    if not user_identifier:
        return True

    if governance_mode == "allow":
        # Modo "Apenas esses contatos"
        allowed_list = [c.get("contact", "").strip().lower() for c in allowed_contacts if c.get("contact")]
        if not allowed_list:
            return True
        return user_identifier.strip().lower() in allowed_list
    else:
        # Modo "Todos exceto esses"
        blocked_list = [c.get("contact", "").strip().lower() for c in blocked_contacts if c.get("contact")]
        if not blocked_list:
            return True
        return user_identifier.strip().lower() not in blocked_list


async def process_chat_message(
    user_message: str,
    school_id: str,
    agent_config: dict,
    chat_history: list = None,
    kaits_token: str = None,
    user_identifier: str = None,
) -> dict:
    """
    Controlador principal que:
      1. Avalia se precisa chamar o VectorDB (RAG)
      2. Manda para IA responder
      3. Extrai um Trace Estruturado das fontes que ela usou.
    """
    
    # 1. Recupera chunks mais relevantes (Vector Search)
    chunks = await search_knowledge(school_id, user_message, top_k=6)
    
    # 2. Manda o super-prompt
    sys_prompt = build_assistant_system_prompt(agent_config, facts=chunks, user_identifier=user_identifier)
    
    messages = [{"role": "system", "content": sys_prompt}]
    
    # Adiciona o histórico no modelo
    if chat_history:
        for hist_msg in chat_history[-10:]:
            role = "assistant" if hist_msg.get("from") == "ai" else "user"
            messages.append({"role": role, "content": hist_msg.get("text", "")})
            
    # Adiciona a mensagem atual
    messages.append({"role": "user", "content": user_message})

    # Ferramentas Dinâmicas baseadas na configuração da escola
    tools = []
    
    # Handover sempre disponível
    tools.append({
        "type": "function",
        "function": {
            "name": "trigger_handover",
            "description": "Acione isso apenas caso o usuário pedir para falar com um atendente humano ou você não possuir informações suficientes para responder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "justificativa_interna": {"type": "string", "description": "Por que você está acionando o humano?"},
                    "resumo_duvida": {"type": "string", "description": "Qual a dúvida exata do cliente."}
                },
                "required": ["justificativa_interna", "resumo_duvida"]
            }
        }
    })

    conf_tools = agent_config.get("tools", {})
    
    # Mapeamento de nomes de tools para chaves de configuração
    tool_map = {
        "consultCourses": "consultCourses",
        "consultStages": "consultStages",
        "consultClasses": "consultClasses",
        "consultClassSchedule": "consultClassSchedule",
        "consultPricing": "consultPricing",
        "checkFinancial": "checkFinancial",
        "listClassStudents": "listClassStudents",
        "searchStudent": "searchStudent",
        "getStudentDetails": "getStudentDetails",
        "consultCourseProgram": "consultCourseProgram",
        "consultTeachers": "consultTeachers",
        "consultDocuments": "consultDocuments",
        "enrollStudent": "enrollStudent"
    }
    
    if conf_tools.get("consultCourses"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultCourses",
                "description": "Consulta os cursos disponíveis da escola. Use quando o usuário perguntar quais cursos existem.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "nome": {"type": "string", "description": "Nome do curso para filtrar"}
                    }
                }
            }
        })

    if conf_tools.get("consultStages"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultStages",
                "description": "Consulta estágios, níveis ou módulos de um curso. Use quando o usuário perguntar pelos níveis de um curso.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "curso_nome": {"type": "string", "description": "Nome do curso, se o usuário informar por texto"}
                    }
                }
            }
        })

    if conf_tools.get("consultClasses"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultClasses",
                "description": "Consulta turmas disponíveis da escola. Use quando o usuário perguntar sobre turmas abertas, vagas ou disponibilidade.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "idEst": {"type": "string", "description": "ID do estágio, se conhecido"},
                        "curso_nome": {"type": "string", "description": "Nome do curso, se o usuário informar por texto"},
                        "estagio_nome": {"type": "string", "description": "Nome do estágio ou nível, se o usuário informar por texto"},
                        "turma_nome": {"type": "string", "description": "Nome da turma, se o usuário informar por texto"},
                        "ignoraVal": {"type": "boolean", "description": "Se deve ignorar valores ao consultar turma"},
                        "incluiNaoDef": {"type": "boolean", "description": "Se deve incluir turmas não definidas"}
                    }
                }
            }
        })

    if conf_tools.get("consultClassSchedule"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultClassSchedule",
                "description": "Consulta horários e aulas de uma turma. Use quando o usuário perguntar pela grade ou agenda da turma.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurm": {"type": "string", "description": "ID da turma, se conhecido"},
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "idEst": {"type": "string", "description": "ID do estágio, se conhecido"},
                        "curso_nome": {"type": "string", "description": "Nome do curso, se o usuário informar por texto"},
                        "estagio_nome": {"type": "string", "description": "Nome do estágio ou nível, se o usuário informar por texto"},
                        "turma_nome": {"type": "string", "description": "Nome da turma, se o usuário informar por texto"}
                    }
                }
            }
        })

    if conf_tools.get("consultPricing"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultPricing",
                "description": "Consulta os valores de uma turma. Use para preço, matrícula, mensalidade e parcelamento.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurm": {"type": "string", "description": "ID da turma, se conhecido"},
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "idEst": {"type": "string", "description": "ID do estágio, se conhecido"},
                        "curso_nome": {"type": "string", "description": "Nome do curso, se o usuário informar por texto"},
                        "estagio_nome": {"type": "string", "description": "Nome do estágio ou nível, se o usuário informar por texto"},
                        "turma_nome": {"type": "string", "description": "Nome da turma, se o usuário informar por texto"},
                        "soMatric": {"type": "boolean", "description": "Mostrar apenas valores de matrícula"}
                    }
                }
            }
        })

    if conf_tools.get("checkFinancial"):
        tools.append({
            "type": "function",
            "function": {
                "name": "checkFinancial",
                "description": "Consulta ficha financeira do aluno, incluindo pagamentos, pendências e boletos. Use para demandas internas da equipe.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idAluno": {"type": "string", "description": "ID do aluno"},
                        "idMatric": {"type": "string", "description": "ID da matrícula"},
                        "semMatric": {"type": "boolean", "description": "Incluir lançamentos sem matrícula"},
                        "idCat": {"type": "string", "description": "ID da categoria de pagamento"}
                    }
                }
            }
        })

    if conf_tools.get("listClassStudents"):
        tools.append({
            "type": "function",
            "function": {
                "name": "listClassStudents",
                "description": "Lista os alunos ou matrículas de uma turma. Use quando a equipe pedir quem está matriculado em determinada turma.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurm": {"type": "string", "description": "ID da turma"},
                        "idCurs": {"type": "string", "description": "ID do curso, se necessário"},
                        "idEst": {"type": "string", "description": "ID do estágio, se necessário"},
                        "movDe": {"type": "string", "description": "Data inicial do filtro (AAAA-MM-DD)"},
                        "movAte": {"type": "string", "description": "Data final do filtro (AAAA-MM-DD)"}
                    }
                }
            }
        })

    if conf_tools.get("searchStudent"):
        tools.append({
            "type": "function",
            "function": {
                "description": "Busca dados básicos de alunos cadastrados. Use quando a equipe precisar localizar um aluno por nome, CPF, e-mail, RG ou matrícula.",
                "name": "searchStudent",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "nome": {"type": "string", "description": "Nome ou parte do nome do aluno"},
                        "CPF": {"type": "string", "description": "CPF do aluno"},
                        "email": {"type": "string", "description": "E-mail do aluno"},
                        "numMatric": {"type": "string", "description": "Número da matrícula do aluno"},
                        "RG": {"type": "string", "description": "RG do aluno"},
                        "limite": {"type": "integer", "description": f"Limite de resultados (padrão: {MAX_RESULTS_DEFAULT})"}
                    }
                }
            }
        })

    if conf_tools.get("getStudentDetails"):
        tools.append({
            "type": "function",
            "function": {
                "name": "getStudentDetails",
                "description": "Busca a ficha completa de um aluno já identificado. Use quando a equipe precisar abrir todos os dados do cadastro.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idAluno": {"type": "string", "description": "ID do aluno"}
                    },
                    "required": ["idAluno"]
                }
            }
        })

    if conf_tools.get("consultCourseProgram"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultCourseProgram",
                "description": "Consulta o programa ou conteúdo do curso ou estágio. Use quando o usuário quiser saber o que será estudado.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idCurs": {"type": "string", "description": "ID do curso"},
                        "idEst": {"type": "string", "description": "ID do estágio"},
                        "curso_nome": {"type": "string", "description": "Nome do curso, se o usuário informar por texto"},
                        "estagio_nome": {"type": "string", "description": "Nome do estágio ou nível, se o usuário informar por texto"}
                    }
                }
            }
        })

    if conf_tools.get("consultTeachers"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultTeachers",
                "description": "Consulta os professores habilitados da escola. Use para demandas internas da equipe.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        })

    if conf_tools.get("consultDocuments"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consultDocuments",
                "description": "Consulta documentos emitidos para aluno ou matrícula. Se o usuário informar o ID do aluno, envie em idAluno. Se informar o ID da matrícula, envie em idMatric. Use numMatric apenas quando a pessoa disser o número da matrícula.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idAluno": {"type": "string", "description": "ID do aluno"},
                        "idMatric": {"type": "string", "description": "ID da matrícula"},
                        "numMatric": {"type": "string", "description": "Número da matrícula"},
                        "filtro": {"type": "string", "description": "Texto de filtro"},
                        "documento": {"type": "string", "description": "Nome do documento"},
                        "emitidoDe": {"type": "string", "description": "Data inicial (AAAA-MM-DD)"},
                        "emitidoAte": {"type": "string", "description": "Data final (AAAA-MM-DD)"}
                    }
                }
            }
        })

    if conf_tools.get("enrollStudent"):
        tools.append({
            "type": "function",
            "function": {
                "name": "enrollStudent",
                "description": "Inicia o processo de pré-matrícula de um novo aluno.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "nome_aluno": {"type": "string", "description": "Nome completo do aluno"},
                        "serie": {"type": "string", "description": "Série ou turma desejada"},
                        "idTurm": {"type": "string", "description": "ID da turma, se já selecionada"}
                    },
                    "required": ["nome_aluno", "serie"]
                }
            }
        })

    # Para obtermos qual source foi usada, pedimos à IA pra responder em um FORMATO ESTRUTURADO.
    response = await openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        tools=tools if tools else None,
        tool_choice="auto",
        temperature=0.3,  # Respostas mais controladas
    )
    
    resp_msg = response.choices[0].message
    
    # Ela ativou alguma tool?
    if resp_msg.tool_calls:
        # Prepara o header de autorização para a API do Kaits
        token_to_use = kaits_token or agent_config.get("apiToken")
        
        for tool_call in resp_msg.tool_calls:
            t_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            if t_name == "trigger_handover":
                fallback_contact = agent_config.get("fallbackContact", "Equipe")
                return {
                    "text": agent_config.get("fallbackUserMessage", "Vou te encaminhar para o humano te ajudar com isso."),
                    "audit": {
                        "type": "tool",
                        "headline": "Chamou um humano",
                        "detail": args.get("resumo_duvida"),
                        "contact": fallback_contact,
                        "notifyMsg": agent_config.get("fallbackMessage", "Um cliente precisa de você!")
                    }
                }
            
            # Verificação DETERMINÍSTICA de acesso antes de qualquer ferramenta KAITS
            if t_name in tool_map:
                tool_key = tool_map[t_name]
                if not check_tool_access(tool_key, user_identifier, agent_config):
                    return {
                        "text": "Desculpe, você não tem permissão para usar esta funcionalidade. Por favor, entre em contato com a secretaria para mais informações.",
                        "audit": {
                            "type": "tool",
                            "headline": "Acesso negado",
                            "detail": f"Usuário não tem permissão para usar {t_name}"
                        }
                    }
            
            if t_name == "consultCourses":
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="curso",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar cursos')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultCourses",
                        tool_name="Consultar cursos",
                        api_result=api_result,
                        audit_headline="Consultou cursos via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultStages":
                if token_to_use:
                    args, resolution_hint = await resolve_course_stage_class_args(
                        token_to_use,
                        user_message,
                        args,
                        require_stage=False,
                        require_class=False,
                    )
                    if resolution_hint:
                        return {
                            "text": resolution_hint,
                            "audit": {"type": "tool", "headline": "Pedir mais detalhes para consultar estágios", "detail": args}
                        }
                if not args.get("idCurs"):
                    return {
                        "text": "Para consultar os estágios ou níveis, preciso identificar qual curso você quer usar.",
                        "audit": {"type": "tool", "headline": "Pedir curso para consultar estágios", "detail": args}
                    }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="estagio",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar estágios')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultStages",
                        tool_name="Consultar estágios ou níveis do curso",
                        api_result=api_result,
                        audit_headline="Consultou estágios via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultClasses":
                if token_to_use:
                    args, resolution_hint = await resolve_course_stage_class_args(
                        token_to_use,
                        user_message,
                        args,
                        require_stage=True,
                        require_class=False,
                    )
                    if resolution_hint:
                        return {
                            "text": resolution_hint,
                            "audit": {"type": "tool", "headline": "Pedir mais detalhes para consultar turmas", "detail": args}
                        }
                if not args.get("idEst"):
                    return {
                        "text": "Para consultar as turmas disponíveis, preciso identificar o curso ou o estágio dessa consulta.",
                        "audit": {"type": "tool", "headline": "Pedir estágio para consultar turmas", "detail": args}
                    }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="turma",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar turmas')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultClasses",
                        tool_name="Consultar turmas disponíveis",
                        api_result=api_result,
                        audit_headline="Consultou turmas via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultClassSchedule":
                if token_to_use:
                    args, resolution_hint = await resolve_course_stage_class_args(
                        token_to_use,
                        user_message,
                        args,
                        require_stage=False,
                        require_class=True,
                    )
                    if resolution_hint:
                        return {
                            "text": resolution_hint,
                            "audit": {"type": "tool", "headline": "Pedir mais detalhes para consultar horários", "detail": args}
                        }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="aulas",
                        action="aulasTurma",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar aulas da turma')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultClassSchedule",
                        tool_name="Consultar horários e aulas de uma turma",
                        api_result=api_result,
                        audit_headline="Consultou horários da turma via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultPricing":
                if token_to_use:
                    args, resolution_hint = await resolve_course_stage_class_args(
                        token_to_use,
                        user_message,
                        args,
                        require_stage=False,
                        require_class=True,
                    )
                    if resolution_hint:
                        return {
                            "text": resolution_hint,
                            "audit": {"type": "tool", "headline": "Pedir mais detalhes para consultar valores", "detail": args}
                        }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="valores",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar valores da turma')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultPricing",
                        tool_name="Consultar valores de uma turma",
                        api_result=api_result,
                        audit_headline="Consultou valores da turma via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "checkFinancial":
                args = infer_financial_lookup_args(user_message, args)
                if token_to_use:
                    args = await resolve_enrollment_identifiers(token_to_use, args)

                if not args.get("idAluno") and not args.get("idMatric"):
                    return {
                        "text": "Para consultar a ficha financeira, preciso do ID do aluno, do ID da matrícula ou do número da matrícula.",
                        "audit": {"type": "tool", "headline": "Pedir identificador para ficha financeira", "detail": args}
                    }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="pagamentos",
                        action="finanAluno",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        if "idCat não existente" in api_result.get("msg", ""):
                            return {
                                "text": "Para consultar a ficha financeira, eu também preciso de uma categoria válida. Você pode me passar, por exemplo, o ID da categoria que deseja consultar.",
                                "audit": {"type": "tool", "headline": "Pedir categoria para ficha financeira", "detail": args}
                            }
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar ficha financeira')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="checkFinancial",
                        tool_name="Consultar ficha financeira do aluno",
                        api_result=api_result,
                        audit_headline="Consultou ficha financeira via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "listClassStudents":
                if not args.get("idTurm"):
                    return {
                        "text": "Para listar os alunos da turma, preciso do ID da turma.",
                        "audit": {"type": "tool", "headline": "Pedir ID da turma para listar alunos", "detail": args}
                    }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="matriculas",
                        action="moviment",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar alunos da turma')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="listClassStudents",
                        tool_name="Consultar alunos de uma turma",
                        api_result=api_result,
                        audit_headline="Consultou alunos da turma via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "searchStudent":
                api_result = None
                has_filter = any([
                    args.get("nome"),
                    args.get("CPF"),
                    args.get("email"),
                    args.get("numMatric"),
                    args.get("RG")
                ])

                if not has_filter:
                    return {
                        "text": "Para poder buscar o aluno, preciso de pelo menos uma informação: nome, CPF, e-mail, RG ou número da matrícula. Qual você tem?",
                        "audit": {"type": "tool", "headline": "Pedir filtro para busca de aluno", "detail": args}
                    }

                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="alunos",
                        action="alunos",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar alunos')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }

                if api_result:
                    api_result = narrow_student_results(api_result, args)
                    if len(json.dumps(api_result, ensure_ascii=False)) > MAX_JSON_LENGTH:
                        return {
                            "text": "Encontrei muitos alunos! Pode me passar mais detalhes, como nome completo, CPF ou matrícula?",
                            "audit": {"type": "tool", "headline": "Pedir mais informações para filtrar alunos", "detail": args}
                        }
                    return await build_tool_success_response(
                        tool_key="searchStudent",
                        tool_name="Buscar aluno por nome, CPF ou matrícula",
                        api_result=api_result,
                        audit_headline="Buscou aluno via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "getStudentDetails":
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="alunos",
                        action="umAluno",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar ficha do aluno')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="getStudentDetails",
                        tool_name="Ver ficha completa de um aluno",
                        api_result=api_result,
                        audit_headline="Consultou ficha completa do aluno via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultCourseProgram":
                if token_to_use:
                    args, program_hint = await resolve_program_lookup_args(token_to_use, user_message, args)
                    if program_hint:
                        return {
                            "text": program_hint,
                            "audit": {"type": "tool", "headline": "Pedir estágio para consultar programa", "detail": args}
                        }
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="programa",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        if "Não existem tópicos" in api_result.get("msg", ""):
                            return {
                                "text": "Esse curso ou estágio não tem tópicos cadastrados no programa até o momento.",
                                "audit": {"type": "tool", "headline": "Programa do curso sem tópicos cadastrados", "detail": args}
                            }
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar programa do curso')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultCourseProgram",
                        tool_name="Consultar programa do curso",
                        api_result=api_result,
                        audit_headline="Consultou programa do curso via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultTeachers":
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="aulas",
                        action="prof",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar professores')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultTeachers",
                        tool_name="Consultar professores",
                        api_result=api_result,
                        audit_headline="Consultou professores via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )

            if t_name == "consultDocuments":
                args = infer_document_lookup_args(user_message, args)
                api_result = None
                if token_to_use:
                    if not args.get("idAluno") and not args.get("idMatric") and args.get("numMatric"):
                        matricula_lookup = await call_kaits_api(
                            token_to_use,
                            endpoint="matriculas",
                            action="moviment",
                            params={"numMatric": args.get("numMatric")}
                        )
                        if matricula_lookup.get("sucesso") == "1":
                            matriculas_exatas = [
                                matricula for matricula in (matricula_lookup.get("matriculas") or [])
                                if str(matricula.get("numMatric", "")).strip() == str(args.get("numMatric")).strip()
                            ]
                            if len(matriculas_exatas) == 1 and matriculas_exatas[0].get("idMatric"):
                                args["idMatric"] = str(matriculas_exatas[0]["idMatric"])

                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="documentos",
                        action="buscaDocs",
                        params=args
                    )
                    if api_result.get("sucesso") != "1":
                        if args.get("numMatric") and "idAluno ou o idMatric" in api_result.get("msg", ""):
                            return {
                                "text": "Encontrei o número da matrícula, mas para localizar os documentos preciso confirmar o ID interno da matrícula ou do aluno. Se você quiser, me passe o ID do aluno ou o ID da matrícula.",
                                "audit": {"type": "tool", "headline": "Pedir identificador interno para documentos", "detail": args}
                            }
                        return {
                            "text": f"Ocorreu um erro: {api_result.get('msg', 'Erro ao consultar documentos emitidos')}",
                            "audit": {"type": "tool", "headline": "Erro na consulta KAITS", "detail": args}
                        }
                if api_result:
                    return await build_tool_success_response(
                        tool_key="consultDocuments",
                        tool_name="Consultar documentos emitidos",
                        api_result=api_result,
                        audit_headline="Consultou documentos emitidos via KAITS API",
                        args=args,
                        agent_config=agent_config,
                        user_message=user_message,
                    )
            
            if t_name == "enrollStudent":
                return {
                    "text": f"Que maravilha! Iniciei a pré-matrícula de {args.get('nome_aluno')} para a série {args.get('serie')} direto no sistema. Em breve nossa secretaria entrará em contato para os próximos passos.",
                    "audit": {"type": "tool", "headline": "Iniciou pré-matrícula", "detail": args}
                }

    # Resposta Convencional (IA falou sozinha sem tool)
    ai_text = resp_msg.content or ""
    
    if chunks:
        used_chunk = chunks[0]
        audit = {
            "type": used_chunk.get("chunk_type", "docs"),
            "docName": used_chunk.get("doc_name", "Treinamento"),
            "page": used_chunk.get("page", 1),
            "lineStart": used_chunk.get("line_start"),
            "lineEnd": used_chunk.get("line_end"),
            "chunk": used_chunk.get("text", "")[:150] + "...",
            "source": used_chunk.get("text"),
            "headline": "Encontrei base no contexto",
            "detail": f"Usou {used_chunk.get('source_ref')}"
        }
    else:
        audit = {
            "type": "ai_chat",
            "headline": "Inteligência Geral",
            "detail": "Respondendo com base no treinamento base (sem documentos específicos)."
        }

    return {
        "text": ai_text,
        "audit": audit
    }
