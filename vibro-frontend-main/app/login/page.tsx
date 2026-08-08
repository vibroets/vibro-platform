"use client"

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { AppDispatch } from "@/redux/store";
import { useDispatch } from "react-redux"
import { setUser, setTokens } from "@/redux/slices/authSlice";
import axios from "axios";
import { slideshowHtml } from "./slideshow-content";
import { vibroLogoDataUri } from "./vibro-logo-data";

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  // Mode: "choice" | "login" | "enquiry"
  const [mode, setMode] = useState<"choice" | "login" | "enquiry">("choice");

  // Enquiry form state
  const [enqName, setEnqName] = useState("");
  const [enqOrg, setEnqOrg] = useState("");
  const [enqEmail, setEnqEmail] = useState("");
  const [enqPhone, setEnqPhone] = useState("");
  const [enqError, setEnqError] = useState("");
  const [enqLoading, setEnqLoading] = useState(false);
  const [enqSubmitted, setEnqSubmitted] = useState(false);


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

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnqLoading(true);
    setEnqError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      await axios.post(`${apiUrl}/enquiries/`, {
        name: enqName,
        organization_name: enqOrg,
        email: enqEmail,
        phone: enqPhone,
      });
      setEnqSubmitted(true);
    } catch (err: any) {
      setEnqError(err.response?.data?.error || "Failed to submit enquiry. Please try again.");
    } finally {
      setEnqLoading(false);
    }
  };

  const renderLogo = () => (
    <div className="mb-6 text-center">
      <div className="flex justify-center mb-3">
        <img src={vibroLogoDataUri} alt="Vibro ETS Logo" className="h-20 w-auto" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">
        <span className="text-blue-600">Vibro</span>
        <span className="text-gray-800">ETS</span>
      </h1>
      <p className="text-sm text-gray-500 mt-1">Operational Excellence, Simplified</p>
    </div>
  );

  const renderContactInfo = () => (
    <div className="mt-8 pt-6 border-t border-gray-200 space-y-3">
      <a
        href="https://www.vibroets.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        www.vibroets.com
      </a>
      <a
        href="mailto:info@vibroets.com"
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        info@vibroets.com
      </a>
      <a
        href="mailto:support@vibroets.com"
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        support@vibroets.com
      </a>
    </div>
  );

  const renderChoice = () => (
    <div className="space-y-4">
      {renderLogo()}
      <p className="text-center text-gray-600 mb-6">Welcome! Please choose an option to continue.</p>
      <button
        onClick={() => setMode("login")}
        className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        Registered User Login
      </button>
      <button
        onClick={() => setMode("enquiry")}
        className="w-full bg-white border-2 border-blue-600 text-blue-600 p-3 rounded-lg hover:bg-blue-50 font-medium transition flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" />
        </svg>
        Enquiry / Not Registered Yet
      </button>
      {renderContactInfo()}
    </div>
  );

  const renderLogin = () => (
    <div>
      {renderLogo()}
      <button
        onClick={() => { setMode("choice"); setShowOtp(false); setError(""); }}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {!showOtp ? (
        <form onSubmit={handleEmailSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Email or Phone</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={loading}
              placeholder="Enter your email or phone number"
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium transition" disabled={loading}>
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
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={loading}
              placeholder={!email.includes('@') ? "Enter your password" : "Enter the OTP sent to your email"}
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium transition" disabled={loading}>
            {loading ? "Verifying..." : email.includes('@') ? "Verify OTP" : "Verify Password"}
          </button>
        </form>
      )}
      {renderContactInfo()}
    </div>
  );

  const renderEnquiry = () => (
    <div>
      {renderLogo()}
      <button
        onClick={() => { setMode("choice"); setEnqSubmitted(false); setEnqError(""); }}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {enqSubmitted ? (
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Thank You!</h2>
          <p className="text-gray-600">Your enquiry has been submitted successfully.</p>
          <p className="text-gray-600 mt-1">We will contact you soon.</p>
          <button
            onClick={() => { setMode("choice"); setEnqSubmitted(false); setEnqName(""); setEnqOrg(""); setEnqEmail(""); setEnqPhone(""); }}
            className="mt-6 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <form onSubmit={handleEnquirySubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={enqName}
              onChange={(e) => setEnqName(e.target.value)}
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={enqLoading}
              placeholder="Enter your full name"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Organisation Name</label>
            <input
              type="text"
              value={enqOrg}
              onChange={(e) => setEnqOrg(e.target.value)}
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={enqLoading}
              placeholder="Enter your organisation name"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={enqEmail}
              onChange={(e) => setEnqEmail(e.target.value)}
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={enqLoading}
              placeholder="Enter your email address"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              type="tel"
              value={enqPhone}
              onChange={(e) => setEnqPhone(e.target.value)}
              className="mt-1 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              disabled={enqLoading}
              placeholder="Enter your phone number"
            />
          </div>
          {enqError && <p className="text-red-500 text-sm mb-3">{enqError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium transition" disabled={enqLoading}>
            {enqLoading ? "Submitting..." : "Submit Enquiry"}
          </button>
        </form>
      )}
      {renderContactInfo()}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-100">
      {/* Left Panel — 30% on desktop, full width on mobile */}
      <div className="w-full lg:w-[30%] flex items-center justify-center bg-white px-6 py-8 lg:py-0 shadow-lg z-10">
        <div className="w-full max-w-sm">
          {mode === "choice" && renderChoice()}
          {mode === "login" && renderLogin()}
          {mode === "enquiry" && renderEnquiry()}
        </div>
      </div>

      {/* Video Slideshow — 70% on desktop, hidden on small mobile screens.
          The slideshow HTML is embedded via srcDoc (not fetched from /public)
          so it always renders regardless of static-file serving. */}
      <div className="hidden lg:block w-[70%] h-screen relative overflow-hidden bg-black">
        <iframe
          srcDoc={slideshowHtml}
          className="w-full h-full border-0"
          title="Vibro ETS Platform Overview"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default LoginPage;