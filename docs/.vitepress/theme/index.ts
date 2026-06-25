import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import BonsaiTreeHero from './components/BonsaiTreeHero.vue';
import './custom.css';

// Extend the default theme and drop the animated hero into the home layout's
// image slot. The component is SSR-safe: it renders only a <canvas> on the
// server and touches browser APIs exclusively inside onMounted.
// https://vitepress.dev/guide/extending-default-theme
export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(BonsaiTreeHero),
    });
  },
} satisfies Theme;
