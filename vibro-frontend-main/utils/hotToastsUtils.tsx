import hotToaster from "react-hot-toast";

export const showWarningToast = (
  message: string,
  type: "success" | "error" | "warning" = "success",
  close?: "Ok",
  duration?: 2000,
  position?: "top-center"
): Promise<void> => {
  return new Promise((resolve) => {
    hotToaster.custom(
      (t) => (
        <div className="relative inset-0 flex items-center justify-center z-[9999] bg-black backdrop-blur-sm">
          <div className="p-6 rounded-xl shadow-lg text-white text-center bg-black">
            <div className="text-2xl mb-2">
              {type === "success" ? "✅" : type === "error" ? "❌" : "⚠️"}
            </div>
            <p className="whitespace-pre-line mb-4">{message}</p>
            {close && (
              <button
                onClick={() => {
                  hotToaster.remove(t.id);
                  resolve();
                }}
                className="bg-white text-black px-4 py-1 rounded-md font-semibold hover:bg-gray-200 transition"
              >
                {close}
              </button>
            )}
          </div>
        </div>
      ),
      { duration: duration, position: position }
    );
  });
};
