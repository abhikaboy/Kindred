// SCRATCH-MOCK: temporary preview data, delete before finishing
const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + dayOffset); return d.toISOString();
};
const cats = [
    { categoryID: "mock-c1", categoryName: "Work", workspaceName: "Personal" },
    { categoryID: "mock-c2", categoryName: "Health", workspaceName: "Personal" },
    { categoryID: "mock-c3", categoryName: "Errands", workspaceName: "Home" },
];
let n = 0;
const t = (content: string, c: number, priority: number, extra: any) => ({ id: `mock-${n++}`, content, priority, value: 1, active: true, public: false, recurring: false, ...cats[c], ...extra });
export default [
    t("Morning run", 1, 1, { startDate: at(0, 7), startTime: at(0, 7), deadline: at(0, 7, 45) }),
    t("Design review", 0, 3, { startDate: at(0, 10), startTime: at(0, 10), deadline: at(0, 11) }),
    t("Lunch with Sam", 2, 0, { startDate: at(0, 12, 30), startTime: at(0, 12, 30), deadline: at(0, 13, 30) }),
    t("Write sprint notes", 0, 2, { startDate: at(0, 15), startTime: at(0, 15), deadline: at(0, 16, 30) }),
    t("Pick up groceries", 2, 1, { deadline: at(0, 18) }),
    t("Call dentist", 1, 2, { startDate: at(0, 0) }),
    t("Ship onboarding copy", 0, 3, { deadline: at(-9, 17) }),
    t("Plan weekend trip", 2, 1, { startDate: at(-5, 0), deadline: at(-4, 0) }),
    t("Gym", 1, 1, { startDate: at(-3, 18), startTime: at(-3, 18), deadline: at(-3, 19) }),
    t("Quarterly taxes", 0, 3, { deadline: at(-1, 12) }),
    t("1:1 with manager", 0, 2, { startDate: at(1, 11), startTime: at(1, 11), deadline: at(1, 11, 30) }),
    t("Yoga", 1, 1, { startDate: at(2, 8), startTime: at(2, 8), deadline: at(2, 9) }),
    t("Renew passport", 2, 2, { deadline: at(4, 17) }),
    t("Read chapter 4", 1, 1, {}),
    t("Fix bike tire", 2, 0, {}),
    t("Reply to recruiter", 0, 2, {}),
];
