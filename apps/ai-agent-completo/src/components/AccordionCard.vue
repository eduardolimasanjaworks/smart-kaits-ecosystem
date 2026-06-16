<script setup>
/**
 * AccordionCard.vue v4
 * Modo sempre expandido (padrão): seções grandes e inteiras, sem sanfona que esconde o formulário.
 * forceOpen / defaultOpen ainda funcionam quando alwaysExpanded=false (uso futuro).
 */
import { ref, watch } from 'vue'

const props = defineProps({
  title: String,
  icon: String,
  statusEmoji: { type: String, default: '⭕' },
  statusTitle: { type: String, default: '' },
  accentColor: { type: String, default: 'var(--c-primary)' },
  defaultOpen: { type: Boolean, default: true },
  forceOpen: { type: Boolean, default: false },
  /** Se true, o bloco não fecha ao clicar e o chevron some — conteúdo sempre visível por inteiro */
  alwaysExpanded: { type: Boolean, default: true }
})

const isOpen = ref(props.alwaysExpanded || props.defaultOpen || props.forceOpen)

watch(
  () => [props.forceOpen, props.alwaysExpanded],
  ([force, always]) => {
    if (always || force) isOpen.value = true
  }
)

function toggleHeader() {
  if (props.alwaysExpanded) return
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div
    class="accordion"
    :class="{ 'accordion--open': isOpen || props.alwaysExpanded, 'accordion--always-expanded': props.alwaysExpanded }"
  >
    <button
      type="button"
      class="accordion__header"
      :class="{ 'accordion__header--static': props.alwaysExpanded }"
      @click="toggleHeader"
    >
      <div class="accordion__title-group">
        <span class="accordion__icon">{{ icon }}</span>
        <span class="accordion__title">{{ title }}</span>
      </div>
      <div class="accordion__right-group">
        <span
          class="accordion__status"
          :class="{ 'accordion__status--done': statusEmoji === '😊' }"
          :title="statusTitle || (statusEmoji === '😊' ? 'Completo' : 'Incompleto')"
        >{{ statusEmoji }}</span>
        <span v-if="!props.alwaysExpanded" class="accordion__chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    </button>

    <div v-show="isOpen" class="accordion__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.accordion {
  background: var(--c-surface);
  border: 1.5px solid var(--c-border);
  border-radius: var(--r-md);
  box-shadow: 0 1px 2px rgba(0,0,0,.02);
  transition: all var(--t-fast);
}
.accordion--open {
  border-color: transparent;
  box-shadow: 0 0 0 1px v-bind(accentColor), 0 4px 16px rgba(0,0,0,.04);
}

/* Cartões de etapa maiores e sempre “abertos” visualmente */
.accordion--always-expanded {
  border-radius: 14px;
  box-shadow: 0 0 0 2px v-bind(accentColor), 0 6px 20px rgba(0,0,0,.06);
}
.accordion--always-expanded.accordion--open {
  box-shadow: 0 0 0 2px v-bind(accentColor), 0 6px 20px rgba(0,0,0,.06);
}

.accordion__header {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: .85rem 1rem; background: transparent; border: none; cursor: pointer;
  border-radius: var(--r-md); transition: background var(--t-fast);
}
.accordion__header:hover { background: #fafafa; }
.accordion__header--static {
  cursor: default;
  padding: 1rem 1.15rem;
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid var(--c-border);
  border-radius: 14px 14px 0 0;
}
.accordion__header--static:hover { background: linear-gradient(180deg, #fafafa 0%, #fff 100%); }

.accordion--always-expanded .accordion__title-group,
.accordion--always-expanded .accordion__right-group { gap: .75rem; }
.accordion--always-expanded .accordion__icon { font-size: 1.35rem; }
.accordion--always-expanded .accordion__title { font-size: 1.05rem; }

.accordion__title-group, .accordion__right-group { display: flex; align-items: center; gap: .6rem; }
.accordion__icon  { font-size: 1.1rem; }
.accordion__title { font-weight: 600; font-size: .875rem; color: var(--c-text); }

.accordion__status { font-size: 1rem; opacity: 0.5; filter: grayscale(1); transition: 0.3s; }
.accordion__status--done { opacity: 1; filter: grayscale(0); animation: popScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

@keyframes popScale { 0% {transform:scale(0)} 50% {transform:scale(1.4)} 100% {transform:scale(1)} }

.accordion__chevron {
  color: var(--c-text-light); transition: transform var(--t-med) ease;
}
.accordion--open .accordion__chevron { transform: rotate(180deg); color: v-bind(accentColor); }

.accordion__content { padding: 0 1rem 1rem 1rem; }
.accordion--always-expanded .accordion__content {
  padding: 1rem 1.15rem 1.25rem;
}
</style>
