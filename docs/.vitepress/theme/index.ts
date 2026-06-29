import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import BonsaiComparison from './components/BonsaiComparison.vue';
import BonsaiTreeHero from './components/BonsaiTreeHero.vue';
import './custom.css';

// Extend the default theme with two home-layout injections: the animated
// tree→bonsai hero in the image slot (Bonsai = the 100% reference), and a
// per-agent research grounding comparison in the full-width band below it.
// Both components are SSR-safe — they render only markup on the server and
// touch browser APIs exclusively inside onMounted.
// https://vitepress.dev/guide/extending-default-theme#layout-slots
export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(BonsaiTreeHero),
      'home-hero-after': () => h(BonsaiComparison),
    });
  },
} satisfies Theme;
