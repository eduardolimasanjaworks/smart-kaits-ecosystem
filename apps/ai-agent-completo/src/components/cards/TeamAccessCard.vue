<script setup>
/**
 * Equipe Smart Kaits — vários utilizadores por escola + mesmo isolamento de dados.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { authService, membersService } from '../../services/api.js'
import { devLog } from '../../utils/devLog.js'

const session = ref(null)
const members = ref([])
const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')

const form = ref({ email: '', password: '', display_name: '' })

const memberLoginForm = ref({ school_slug: '', email: '', password: '' })
const showMemberLogin = ref(false)

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    session.value = await authService.getSession()
    members.value = await membersService.list()
  } catch (e) {
    errorMsg.value = 'Não foi possível carregar a equipe.'
    devLog.error(e)
  } finally {
    loading.value = false
  }
}

function onSync() {
  load()
}

onMounted(() => {
  load()
  window.addEventListener('smartkaits-sync', onSync)
})
onUnmounted(() => {
  window.removeEventListener('smartkaits-sync', onSync)
})

const isPrincipal = () => session.value && !session.value.is_member_session

async function addMember() {
  if (!form.value.email.trim() || form.value.password.length < 8) {
    errorMsg.value = 'Informe um e-mail válido e senha com pelo menos 8 caracteres.'
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    await membersService.create({
      email: form.value.email.trim(),
      password: form.value.password,
      display_name: form.value.display_name.trim(),
    })
    form.value = { email: '', password: '', display_name: '' }
    await load()
  } catch (e) {
    const d = e.response?.data?.detail
    errorMsg.value =
      typeof d === 'string' ? d : 'Não foi possível criar o utilizador.'
    devLog.error(e)
  } finally {
    saving.value = false
  }
}

async function removeMember(id) {
  if (!confirm('Remover este acesso? Ele deixa de conseguir entrar com este e-mail.')) return
  saving.value = true
  errorMsg.value = ''
  try {
    await membersService.remove(id)
    await load()
  } catch (e) {
    errorMsg.value = 'Não foi possível remover.'
    devLog.error(e)
  } finally {
    saving.value = false
  }
}

async function doMemberLogin() {
  saving.value = true
  errorMsg.value = ''
  try {
    await authService.memberLogin(
      memberLoginForm.value.school_slug.trim(),
      memberLoginForm.value.email.trim(),
      memberLoginForm.value.password
    )
    window.location.reload()
  } catch (e) {
    errorMsg.value = 'E-mail, slug ou senha incorretos.'
    devLog.error(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="team-access">
    <p class="team-access__lead">
      Vários colegas podem configurar o mesmo Smart Kaits ao mesmo tempo.
      Cada escola continua com seus próprios dados e documentos isolados (incluindo busca na base de conhecimento).
      Alterações aparecem para os outros em poucos segundos, sem dar F5.
    </p>

    <div v-if="loading" class="team-access__muted">Carregando…</div>

    <template v-else>
      <div v-if="session" class="team-access__badge">
        <template v-if="session.is_member_session && session.member">
          <span class="team-access__pill team-access__pill--member"
            >Equipe: {{ session.member.display_name || session.member.email }}</span
          >
        </template>
        <template v-else>
          <span class="team-access__pill team-access__pill--admin"
            >Acesso principal da escola (administrador)</span
          >
        </template>
      </div>

      <p v-if="errorMsg" class="team-access__err" role="alert">{{ errorMsg }}</p>

      <div v-if="isPrincipal()" class="team-access__admin">
        <h4 class="team-access__h">Convidar utilizador</h4>
        <p class="team-access__hint">
          Esta pessoa usará o <strong>slug da escola</strong> + <strong>e-mail</strong> +
          <strong>senha</strong> em “Sou da equipe”, em vez da senha única da escola.
        </p>
        <div class="team-access__grid">
          <label>
            <span>Nome (opcional)</span>
            <input v-model="form.display_name" type="text" maxlength="120" placeholder="Ex.: Ana — financeiro" />
          </label>
          <label>
            <span>E-mail</span>
            <input v-model="form.email" type="email" autocomplete="off" placeholder="colega@escola.edu.br" />
          </label>
          <label>
            <span>Senha inicial</span>
            <input v-model="form.password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
          </label>
        </div>
        <button
          type="button"
          class="btn btn-primary team-access__btn"
          :disabled="saving"
          @click="addMember"
        >
          {{ saving ? 'Salvando…' : 'Adicionar à equipe' }}
        </button>

        <h4 class="team-access__h">Pessoas com acesso</h4>
        <ul v-if="members.length" class="team-access__list">
          <li v-for="m in members" :key="m.id" class="team-access__row">
            <div>
              <strong>{{ m.display_name || m.email }}</strong>
              <span class="team-access__email">{{ m.email }}</span>
            </div>
            <button
              type="button"
              class="btn btn-ghost team-access__remove"
              :disabled="saving"
              @click="removeMember(m.id)"
            >
              Remover
            </button>
          </li>
        </ul>
        <p v-else class="team-access__muted">Ainda não há logins de equipe — só o acesso principal.</p>
      </div>

      <div v-else class="team-access__member-note">
        <p>
          Você está com um <strong>login de equipe</strong>. Para convidar outras pessoas,
          peça a quem tem a <strong>senha principal da escola</strong> para abrir esta tela.
        </p>
      </div>

      <details class="team-access__details" :open="showMemberLogin" @toggle="showMemberLogin = $event.target.open">
        <summary>Sou da equipe — entrar com e-mail e senha</summary>
        <div class="team-access__grid team-access__grid--member">
          <label>
            <span>Slug da escola</span>
            <input v-model="memberLoginForm.school_slug" type="text" autocomplete="off" placeholder="ex.: colegio-alfa" />
          </label>
          <label>
            <span>E-mail cadastrado</span>
            <input v-model="memberLoginForm.email" type="email" autocomplete="username" />
          </label>
          <label>
            <span>Senha</span>
            <input v-model="memberLoginForm.password" type="password" autocomplete="current-password" />
          </label>
        </div>
        <button type="button" class="btn btn-primary team-access__btn" :disabled="saving" @click="doMemberLogin">
          {{ saving ? 'Entrando…' : 'Entrar como membro da equipe' }}
        </button>
      </details>
    </template>
  </div>
</template>

<style scoped>
.team-access__lead {
  font-size: 0.88rem;
  line-height: 1.55;
  color: #475569;
  margin-bottom: 1rem;
}
.team-access__muted {
  font-size: 0.85rem;
  color: #94a3b8;
}
.team-access__badge {
  margin-bottom: 0.75rem;
}
.team-access__pill {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
}
.team-access__pill--admin {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
}
.team-access__pill--member {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #6ee7b7;
}
.team-access__err {
  font-size: 0.82rem;
  color: #b91c1c;
  margin: 0.5rem 0;
}
.team-access__h {
  font-size: 0.82rem;
  margin: 1rem 0 0.35rem;
  color: #0f172a;
}
.team-access__hint {
  font-size: 0.78rem;
  color: #64748b;
  margin-bottom: 0.65rem;
  line-height: 1.45;
}
.team-access__grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.team-access__grid label span {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 0.2rem;
}
.team-access__grid input {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  font-size: 0.85rem;
}
.team-access__btn {
  margin-top: 0.65rem;
  width: 100%;
  justify-content: center;
}
.team-access__list {
  list-style: none;
  padding: 0;
  margin: 0.35rem 0 0;
}
.team-access__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.82rem;
}
.team-access__email {
  display: block;
  font-size: 0.72rem;
  color: #94a3b8;
}
.team-access__remove {
  font-size: 0.72rem !important;
  padding: 0.25rem 0.5rem !important;
}
.team-access__member-note {
  font-size: 0.82rem;
  color: #475569;
  line-height: 1.5;
}
.team-access__details {
  margin-top: 1.25rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.team-access__details summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 0.82rem;
  color: #334155;
}
.team-access__details[open] summary {
  margin-bottom: 0.65rem;
}
.team-access__grid--member {
  margin-top: 0.5rem;
}
</style>
