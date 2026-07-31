import Toast from "react-native-toast-message";

// utils/errorHandler.ts
export const handleApiError = (error: any): string => {
  if (error.response) {
    // Server responded with a status code outside 2xx
    return (
      error.response.data || error.response.data.message || "Request failed"
    );
  } else if (error.request) {
    // No response received
    return "No response from server";
  } else {
    // Something wrong with request setup
    return error.message || "Request failed";
  }
};

export const onShowTostMessage = (param: any) => {
  const { toastType = "error", message = "" } = param;
  Toast.show({
    type: toastType,
    text1: toastType === "error" ? "Error!" : "Success",
    text2: message,
  });
};
