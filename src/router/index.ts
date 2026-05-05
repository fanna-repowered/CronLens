import { createRouter, createWebHistory } from "vue-router"
import CronLensView from "@/views/CronLensView.vue"

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "cronlens",
      component: CronLensView,
    },
  ],
})

export default router
