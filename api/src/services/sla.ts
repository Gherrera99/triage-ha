export function slaMinutes(classification: "GREEN" | "YELLOW" | "RED") {
    if (classification === "GREEN") return 45;
    if (classification === "YELLOW") return 30;
    return 0;
}
