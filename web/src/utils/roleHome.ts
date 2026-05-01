// web/src/utils/roleHome.ts
// Fuente única de verdad para la ruta de inicio por rol.
// Importar desde LoginView y router en lugar de duplicar.
export function homeByRole(role?: string): string {
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
