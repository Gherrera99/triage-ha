import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import DoctorView from "../views/DoctorView.vue";
import CashierView from "../views/CashierView.vue";
import TriageNurseView from "../views/TriageNurseView.vue";
import AdminDashboard from "../views/AdminDashboard.vue";
import AdminUsersView from "../views/AdminUsersView.vue";
import { useAuthStore } from "../stores/auth";

function homeByRole(role?: string) {
    switch (role) {
        case "NURSE_TRIAGE":
            return "/triage";
        case "CASHIER":
            return "/cashier";
        case "DOCTOR":
            return "/doctor";
        case "ADMIN":
            return "/admin/reports";
        case "CONSULTOR":
            return "/admin/reports";
        default:
            return "/login";
    }
}

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/login", component: LoginView },

        { path: "/triage", component: TriageNurseView, meta: { role: "NURSE_TRIAGE" } },
        { path: "/cashier", component: CashierView, meta: { role: "CASHIER" } },
        { path: "/doctor", component: DoctorView, meta: { role: "DOCTOR" } },

        { path: "/admin/reports", component: AdminDashboard, meta: { role: "ADMIN" } },
        { path: "/admin/users", component: AdminUsersView, meta: { role: "ADMIN" } },

        { path: "/", redirect: "/login" },
        { path: "/:pathMatch(.*)*", redirect: "/login" },
    ],
});

router.beforeEach((to) => {
    const auth = useAuthStore();
    auth.init();

    // ✅ si ya estás logueado y vas a /login, mándalo a su home
    if (to.path === "/login" && auth.token && auth.user) {
        return homeByRole(auth.user.role);
    }

    if (to.path === "/login") return true;

    if (!auth.token || !auth.user) return "/login";

    const requiredRole = to.meta.role as string | undefined;
    if (requiredRole && auth.user.role !== requiredRole) {
        return homeByRole(auth.user.role);
    }

    return true;
});

export default router;
