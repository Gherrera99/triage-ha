// web/src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import CashierView from "../views/CashierView.vue";
import TriageNurseView from "../views/TriageNurseView.vue";
import AdminDashboard from "../views/AdminDashboard.vue";
import AdminUsersView from "../views/AdminUsersView.vue";
import DoctorDashboardView from "../views/DoctorDashboardView.vue";
import DoctorConsultView from "../views/DoctorConsultView.vue";
import { useAuthStore } from "../stores/auth";
import { homeByRole } from "../utils/roleHome";

// ChangePasswordView carga de forma diferida para no penalizar bundle inicial
const ChangePasswordView = () => import("../views/ChangePasswordView.vue");

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/login", component: LoginView },

        {
            path: "/cambiar-password",
            component: ChangePasswordView,
            meta: { requiresAuth: true },
        },

        { path: "/triage", component: TriageNurseView, meta: { role: ["NURSE_TRIAGE", "ADMIN"] } },
        { path: "/cashier", component: CashierView, meta: { role: ["CASHIER", "ADMIN"] } },
        { path: "/doctor", component: DoctorDashboardView, meta: { role: ["DOCTOR", "ADMIN"] } },
        { path: "/doctor/consult/:id", component: DoctorConsultView, meta: { role: ["DOCTOR", "ADMIN"] } },

        { path: "/admin/reports", component: AdminDashboard, meta: { role: ["ADMIN", "CONSULTOR"] } },
        { path: "/admin/users", component: AdminUsersView, meta: { role: "ADMIN" } },

        { path: "/", redirect: "/login" },
        { path: "/:pathMatch(.*)*", redirect: "/login" },
    ],
});

router.beforeEach((to) => {
    const auth = useAuthStore();
    auth.init();

    // --- Rutas públicas ---
    if (to.path === "/login") {
        // Si ya está autenticado y SIN pendiente de cambio de contraseña, ir a su home
        if (auth.token && auth.user && !auth.user.mustChangePassword) {
            return homeByRole(auth.user.role);
        }
        // Si está autenticado pero debe cambiar contraseña, permitir /login
        // (no queremos redirigir a /cambiar-password desde /login — él llegó acá
        // probablemente por logout manual).
        return true;
    }

    // --- Requiere sesión activa ---
    if (!auth.token || !auth.user) return "/login";

    // --- Guard mustChangePassword ---
    // Si el usuario tiene pendiente cambiar su contraseña, solo puede ir a /cambiar-password
    if (auth.user.mustChangePassword && to.path !== "/cambiar-password") {
        return "/cambiar-password";
    }

    // Si ya cambió la contraseña y navega a /cambiar-password, redirigir a su home
    if (!auth.user.mustChangePassword && to.path === "/cambiar-password") {
        return homeByRole(auth.user.role);
    }

    // --- Guard de rol ---
    const required = to.meta.role as string | string[] | undefined;
    if (!required) return true;

    // ADMIN como superusuario
    if (auth.user.role === "ADMIN") return true;

    const allowed = Array.isArray(required)
        ? required.includes(auth.user.role)
        : auth.user.role === required;

    if (!allowed) return homeByRole(auth.user.role);

    return true;
});

export default router;
