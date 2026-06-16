<script setup>
/**
 * Scrim fullscreen com blur — Teleport no body para ficar acima do grid e do iframe.
 */
defineProps({
  active: { type: Boolean, default: true },
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="active" class="onboarding-scrim" aria-hidden="true">
        <div class="onboarding-scrim__backdrop" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onboarding-scrim {
  position: fixed;
  inset: 0;
  z-index: 142;
  pointer-events: none;
}
.onboarding-scrim__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(26px) saturate(0.75);
  -webkit-backdrop-filter: blur(26px) saturate(0.75);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
