"use client"

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { AppDispatch } from "@/redux/store";
import { useDispatch } from "react-redux"
import { setUser, setTokens } from "@/redux/slices/authSlice";

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axiosInstance.post("/auth/request-otp/", { email, platform: "web", });
      if (!email.includes('@')) {
      setShowOtp(true); // Proceed to password entry for location leader
      return; // Exit early, no OTP needed
    }

      setShowOtp(true);
      setError("");
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 403) {
          setError(data.error || "Your account is currently inactive. Please contact Admin.");
          setShowOtp(false);
        } else {
          setError(data.error || "Failed to send OTP. Email doesn't exist.");
        }
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };




  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("Verify Payload:", { identifier: email, otp });

      const response = await axiosInstance.post("/auth/verify-otp/", { identifier: email, otp, platform: "web", });
      console.log("Response after login for user >> ", response.data)
      const { access, refresh, user, module_permissions } = response.data;

      // Merge module_permissions into user
      const mergedUser = { ...user, module_permissions };

      // Dispatch to Redux
      dispatch(setUser(mergedUser));
      dispatch(setTokens({ access, refresh }));
      window.dispatchEvent(new Event("route-loader-start"));

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Verify OTP Error:", error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError(!email.includes('@') ? "Invalid password. Please try again." : "Invalid OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Vibro Login</h1>
        {!showOtp ? (
          <form onSubmit={handleEmailSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Email or Phone</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 p-2 w-full border rounded-md"
                required
                disabled={loading}
                placeholder="Enter your email or phone number"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300" disabled={loading}>
              {loading ? "Processing..." : email.includes('@') ? "Send OTP" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">{!email.includes('@') ? "Enter Password" : "Enter OTP"}</label>
              <input
                type={!email.includes('@') ? "password" : "text"}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-1 p-2 w-full border rounded-md"
                required
                disabled={loading}
                placeholder={!email.includes('@') ? "Enter your password" : "Enter the OTP sent to your email"}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300" disabled={loading}>
              {loading ? "Verifying..." : email.includes('@') ? "Verify OTP" : "Verify Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;