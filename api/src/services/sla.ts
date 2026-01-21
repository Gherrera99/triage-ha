export function slaMinutes(classification: "GREEN" | "YELLOW" | "RED") {
    if (classification === "GREEN") return 120;
    if (classification === "YELLOW") return 60;
    return 0;
}
