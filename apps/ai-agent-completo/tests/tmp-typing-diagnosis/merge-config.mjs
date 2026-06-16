/**
 * Simula race: utilizador digita enquanto GET remoto faz Object.assign no config.
 * Apagar com a pasta tests/tmp-typing-diagnosis/
 */

function assignConfig(local, remote) {
  return Object.assign(local, remote)
}

let local = { personality: 'Amigável e ' }
const remote = { personality: 'Amigável e objetiva' } // servidor sem último caractere

const after = assignConfig({ ...local }, remote)
const lostChars = local.personality.length > after.personality.length
  || after.personality !== local.personality

console.log('Local antes:', local.personality)
console.log('Remote GET:', remote.personality)
console.log('Após assign:', after.personality)
console.log('Bug reproduzido (perde edição):', lostChars || after.personality.length < 'Amigável e objetiva!'.length)

if (!lostChars && after.personality === remote.personality) {
  console.log('OK: documenta que assign substitui string inteira — guards devem bloquear refresh durante edição.')
  process.exit(0)
}
process.exit(lostChars ? 0 : 1)
