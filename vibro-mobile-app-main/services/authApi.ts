import { post } from ".";
import { AUTH_REQUEST_OPT, AUTH_VERIFY_OTP } from "./constants";

export const Api = {

  async verifyEmail(data: any): Promise<any> {
    try {
      const res = await post(AUTH_REQUEST_OPT, data);
      return res;
    } catch (error: any) {
      let message = "";

      // ✅ Priority order for message
      if (error?.data?.error) {
        // Backend business-rule message (403)
        message = error.data.error;
      } else if (error?.data?.email?.[0]) {
        // Serializer validation error
        message = error.data.email[0];
      } else if (error?.data?.message) {
        message = error.data.message;
      } else {
        message = error?.message || "Something went wrong";
      }

      return {
        message,
        isAxiosError: true,
        status: error?.status,
        data: error?.data,
      };
    }
  },


  async verifyOTP(data: {
    identifier: string;
    otp: string;
    platform: string;
  }) {
    try {
      const res = await post(AUTH_VERIFY_OTP, data);

      return {
        isAxiosError: false,
        ...(res as Record<string, any>), // safe spread
      };
    } catch (error: any) {
      return {
        isAxiosError: true,
        message:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "OTP verification failed",
      };
    }
  },


  async verifyOtp(otp: any): Promise<string> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return "mock-auth-token";
  },
};
