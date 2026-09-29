jest.mock("react-native-toastable", () => ({ showToastable: jest.fn() }));
import { showToastable } from "react-native-toastable";
import { handleSilentPush, isSilentPush } from "@/utils/silentPushHandlers";
import { getNotificationRefreshPlan } from "@/utils/notificationInvalidation";

describe("silent pushes", () => {
    it("treats a push with no title or body as silent", () => {
        expect(isSilentPush({ title: null, body: null })).toBe(true);
        expect(isSilentPush({ title: "Hi", body: "" })).toBe(false);
    });

    it("announces where an auto-sorted task was filed and refreshes workspaces", () => {
        handleSilentPush({ type: "task_filed", taskName: "Buy milk", categoryName: "Groceries" });
        expect(showToastable).toHaveBeenCalledWith(expect.objectContaining({ message: 'Filed "Buy milk" in Groceries' }));
        expect(getNotificationRefreshPlan("task_filed")).toMatchObject({ all: false, workspaces: true });
    });

    it("ignores unknown types", () => {
        (showToastable as jest.Mock).mockClear();
        handleSilentPush({ type: "something_new" });
        expect(showToastable).not.toHaveBeenCalled();
    });
});
