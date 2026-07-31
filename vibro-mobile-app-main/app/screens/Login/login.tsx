// import { loginRequest } from "@/Redux/reducer/auth/authSlice";
// import axiosInstance from "@/utility/Services";
// import { useRouter } from "expo-router";
// import React, { useState } from "react";
// import {
//   RefreshControl,
//   SafeAreaView,
//   ScrollView,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   selectAuthError,
//   selectAuthLoading,
// } from "../../../Redux/reducer/auth/authSelectors";

// const Login = () => {
//   const [email, setEmail] = useState("");
//   const [otp, setOtp] = useState("");
//   const [isOtpSent, setIsOtpSent] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const dispatch = useDispatch();
//   const isLoading = useSelector(selectAuthLoading);
//   const error = useSelector(selectAuthError);
//   console.log("isLoading", isLoading);
//   const router = useRouter();

//   const handleSendOtp = async () => {
//     setLoading(true);
//     try {
//       console.log("Sending OTP to:", email);
//       await axiosInstance.post("/auth/request-otp/", { email });
//       setIsOtpSent(true);
//     } catch (error) {
//       console.error("Failed to send OTP:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyOtp = async () => {
//     setLoading(true);
//     try {
//       console.log("Verifying OTP:", otp);
//       await axiosInstance.post("/auth/verify-otp/", { email, otp });
//       console.log("Login successful");
//       router.push("/screens/home/home");
//     } catch (error) {
//       console.error("Invalid OTP:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleLogin = (email: string, password: string) => {
//     dispatch(loginRequest({ email, password }));
//   };

//   const onRefresh = () => {
//     handleLogin("admin@gmaocm", "12123");
//     // setRefreshing(true);
//     // setEmail("");
//     // setOtp("");
//     // setIsOtpSent(false);
//     // setLoading(false);
//     // setTimeout(() => {
//     //   setRefreshing(false);
//     // }, 1000);
//   };

//   return (
//     <SafeAreaView className="flex-1 bg-[#2662f0]">
//       <ScrollView
//         contentContainerStyle={{ flexGrow: 1 }}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//       >
//         <View className="flex-1 justify-center px-8">
//           {/* Logo Section */}
//           <View className="items-center mb-12">
//             <View className="w-20 h-20 rounded-full border-4 border-[#bfdbff] items-center justify-center mb-6 relative">
//               <Text className="text-4xl font-bold text-white">V</Text>
//               <View className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#bfdbff]" />
//               <View className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-[#bfdbff]" />
//             </View>
//             <Text className="text-3xl font-bold text-white mb-1">
//               Welcome to Vibro
//             </Text>
//             <Text className="text-base text-white text-center">
//               Login with your email
//             </Text>
//           </View>

//           {/* Email or OTP Section */}
//           <View className="mb-10">
//             {!isOtpSent ? (
//               <>
//                 <Text className="text-white text-base mb-2">Email</Text>
//                 <TextInput
//                   className="bg-transparent border-b border-[#94a3b8] text-white text-lg pb-2 mb-6"
//                   placeholder="Enter your email"
//                   placeholderTextColor="#94a3b8"
//                   value={email}
//                   onChangeText={setEmail}
//                   keyboardType="email-address"
//                   autoCapitalize="none"
//                 />
//                 <TouchableOpacity
//                   className="bg-[#bfdbff] py-4 rounded-lg items-center"
//                   onPress={handleSendOtp}
//                   activeOpacity={0.8}
//                   disabled={loading || !email}
//                 >
//                   <Text className="text-[#0f172a] text-lg font-semibold">
//                     {loading ? "Sending..." : "Send OTP"}
//                   </Text>
//                 </TouchableOpacity>
//               </>
//             ) : (
//               <>
//                 <Text className="text-white text-base mb-2">Enter OTP</Text>
//                 <TextInput
//                   className="bg-transparent border-b border-[#94a3b8] text-white text-lg pb-2 mb-6 tracking-widest"
//                   placeholder="Enter OTP"
//                   placeholderTextColor="#94a3b8"
//                   value={otp}
//                   onChangeText={setOtp}
//                   keyboardType="number-pad"
//                   maxLength={6}
//                 />
//                 <TouchableOpacity
//                   className="bg-[#bfdbff] py-4 rounded-lg items-center"
//                   onPress={handleVerifyOtp}
//                   activeOpacity={0.8}
//                   disabled={loading || otp.length !== 6}
//                 >
//                   <Text className="text-[#0f172a] text-lg font-semibold">
//                     {loading ? "Verifying..." : "Verify OTP"}
//                   </Text>
//                 </TouchableOpacity>
//               </>
//             )}
//           </View>

//           {/* Reset Button */}
//           <TouchableOpacity className="items-center mt-2" onPress={onRefresh}>
//             <Text className="text-white underline text-sm">Reset Form</Text>
//           </TouchableOpacity>
//         </View>

//         {/* Footer */}
//         {!isOtpSent && (
//           <View className="px-8 pb-8">
//             <Text className="text-[#94a3b8] text-sm text-center leading-5">
//               Your email must be pre-authorized by your organization to sign in.
//             </Text>
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// export default Login;
