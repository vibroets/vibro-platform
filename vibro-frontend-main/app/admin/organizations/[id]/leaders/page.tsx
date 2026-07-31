"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import axiosInstance from "@/utils/axiosInstance";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { showWarningToast } from "@/utils/hotToastsUtils";
import hotToaster from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableHead as TH, // alias if your UI uses TableHead
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import GlobalLoader from "@/components/ui/globalloader";

interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  locationname: string;
  rolename: string;
  location: number | null;
  locationid: number | null;
  phone: string;
  empid: string | null;
  organization: number;
}

type Leader = {
  id: number; // This is the LocationLeader model ID
  userId: number; // This is the CustomUser ID
  firstName: string;
  name: string;
  email: string;
  location: number | null;
  phone: string;
  role: number | null;
  empid: string | null;
  password: string;
};

interface Location {
  id: number;
  name: string;
}

const formSchema = z.object({
  locationId: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function LocationLeaderPage() {
  const params = useParams();
  const Orgid = params.id;
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"promote" | "depromote">(
    "promote"
  );

  const [selectedLeaders, setSelectedLeaders] = useState<Leader[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [locationConflictMessage, setLocationConflictMessage] = useState("");

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showLeaderDetailsDialog, setShowLeaderDetailsDialog] = useState(false);
  const [leaderDetailsSearchTerm, setLeaderDetailsSearchTerm] = useState("");
  const [password, setPassword] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  const [error, setError] = useState("");
  const canPromote = isSubmitting ? false : selectedUser !== null || hasChanges;

  const [selectedLeaderToDepromote, setSelectedLeaderToDepromote] =
    useState<Leader | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      locationId: "",
    },
  });

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  const isValidPassword = (value: string) => {
    return /^\d{6,}$/.test(value); // Only numbers, at least 4 digits
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    if (!/^\d*$/.test(value)) {
      setError("Password must contain only numbers");
    } else if (value.length > 0 && value.length < 6) {
      setError("Password must be at least 6 digits");
    } else {
      setError("");
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/users/list");
      const leadersres = await axiosInstance.get("location-leaders/list/");
      const users =
        res.data?.map((value: any) => ({
          id: value.id,
          name: `${value.first_name} ${value.last_name}`,
          email: value.email,
          role: value.role_details?.name || "",
          location: value.location,
          locationid: value.location_details?.id,
          locationname: value.location_details?.description,
          rolename: value.role_details?.description,
          phone: value.phone,
          empid: value.employee_id,
          organization: value.organization,
        })) || [];

      const formatted = (leadersres.data || [])
        .filter((item: any) => item.organization.id === parseInt(Orgid as string))
        .map((item: any) => ({
          id: item.id,
          userId: item.user.id,
          firstName: item.user.first_name || "",
          name: `${item.user.first_name} ${item.user.last_name}`,
          email: item.user.email,
          location: item.user.location,
          phone: item.user.phone,
          role: item.user.role,
          empid: item.user.employee_id || "",
          password: item.password != null ? String(item.password) : "",
        }));
      const available = users.filter((u: User) => u.role === "end_user" && u.organization === parseInt(Orgid as string));

      setSelectedLeaders(formatted);
      setAvailableUsers(available);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axiosInstance.get(`/location/${Orgid}/`);
      setLocations(res.data || []);
    } catch (err) {
      console.error("Failed to fetch locations", err);
    }
  };

  const filteredUsers = availableUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLeaderDetails = selectedLeaders.filter((leader) => {
    const query = leaderDetailsSearchTerm.trim().toLowerCase();
    if (!query) return true;

    const locationName =
      locations.find((loc) => loc.id === leader.location)?.name || "";

    const passwordText = String(leader.password ?? "").toLowerCase();

    return (
      leader.firstName?.toLowerCase().includes(query) ||
      leader.name?.toLowerCase().includes(query) ||
      leader.email?.toLowerCase().includes(query) ||
      leader.phone?.toLowerCase().includes(query) ||
      passwordText.includes(query) ||
      (leader.empid || "").toLowerCase().includes(query) ||
      locationName.toLowerCase().includes(query)
    );
  });

  // ---------- usersByLocation state (single source of truth) ----------
  const [usersByLocation, setUsersByLocation] = useState<
    Record<string, string[]>
  >({});
  const [initialUsersByLocation, setInitialUsersByLocation] = useState<
    Record<string, string[]>
  >({});

  // per-location add-user input values
  const [newUserInputs, setNewUserInputs] = useState<Record<string, string>>(
    {}
  );

  // Group and set after availableUsers changes
  useEffect(() => {
    // This effect now populates the editable table state based on current leaders
    if (locations.length > 0) {
      const groupedByLocationName = selectedLeaders.reduce(
        (acc: Record<string, string[]>, leader) => {
          const locationObj = locations.find(
            (loc) => loc.id === leader.location
          );
          const locationName = locationObj ? locationObj.name : "No Location";

          if (!acc[locationName]) {
            acc[locationName] = [];
          }
          acc[locationName].push(leader.name);
          return acc;
        },
        {}
      );
      setUsersByLocation(groupedByLocationName);
      setInitialUsersByLocation(groupedByLocationName); // Also set the initial state for comparison
    } else {
      setUsersByLocation({});
      setInitialUsersByLocation({});
    }
  }, [selectedLeaders, locations]);

  // leader locations derived from usersByLocation
  const leaderLocations = Object.keys(usersByLocation);

  // ---------- handlers ----------
  const handleUsernameChange = (
    location: string,
    index: number,
    newName: string
  ) => {
    setUsersByLocation((prev) => {
      const users = prev[location] ? [...prev[location]] : [];
      users[index] = newName;
      return { ...prev, [location]: users };
    });
  };

  const handleRemoveUser = (location: string, index: number) => {
    setUsersByLocation((prev) => {
      const users = prev[location] ? [...prev[location]] : [];
      users.splice(index, 1);
      return { ...prev, [location]: users };
    });
    // clear newUserInputs if location removed all
    setNewUserInputs((prev) => ({ ...prev, [location]: prev[location] || "" }));
    setHasChanges(true);
  };

  const handleAddUser = (location: string) => {
    const candidate = (newUserInputs[location] || "").trim();
    if (!candidate) return;

    setUsersByLocation((prev) => {
      const users = prev[location] ? [...prev[location]] : [];
      if (!users.includes(candidate)) users.push(candidate);
      return { ...prev, [location]: users };
    });

    setNewUserInputs((prev) => ({ ...prev, [location]: "" }));
    setHasChanges(true);
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setSelectedLocationId(user.locationid);
    setSearchTerm(`${user.name} (${user.empid})`);
    setShowDropdown(false);
  };

  const handlePromote = async () => {
    setIsSubmitting(true);

    // Helper to find the necessary ID for a user by name.
    const findUserId = (name: string): number | string | undefined => {
      const available = availableUsers.find((u) => u.name === name);
      if (available) return available.id;

      const leader = selectedLeaders.find((l) => l.name === name);
      if (leader) return leader.userId; // Use the new userId field

      return undefined;
    };

    const initialLocations = Object.keys(initialUsersByLocation);
    const currentLocations = Object.keys(usersByLocation);
    const allLocations = [
      ...new Set([...initialLocations, ...currentLocations]),
    ];

    const idsToPromote: (string | number)[] = [];
    const idsToDemote: (string | number)[] = [];

    for (const location of allLocations) {
      const initialUsers = initialUsersByLocation[location] || [];
      const currentUsers = usersByLocation[location] || [];

      // Find users to promote for this location (in current but not in initial)
      for (const userName of currentUsers) {
        if (!initialUsers.includes(userName)) {
          const userId = findUserId(userName);
          if (userId) idsToPromote.push(userId);
        }
      }

      // Find users to demote for this location (in initial but not in current)
      for (const userName of initialUsers) {
        if (!currentUsers.includes(userName)) {
          const userId = findUserId(userName);
          if (userId) idsToDemote.push(userId);
        }
      }
    }

    const uniqueIdsToPromote = [...new Set(idsToPromote)];
    const uniqueIdsToDemote = [...new Set(idsToDemote)];

    // Also account for a user selected from the top search box
    if (selectedUser && !uniqueIdsToPromote.includes(selectedUser.id)) {
      uniqueIdsToPromote.push(selectedUser.id);
    }

    if (uniqueIdsToPromote.length === 0 && uniqueIdsToDemote.length === 0) {
      hotToaster.custom(
        "No Changes Detected\nYou haven't made any changes to the leadership assignments."
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const promises = [];

      // Promotion API call
      if (uniqueIdsToPromote.length > 0) {
        const payload: { user_ids: (string | number)[]; password?: string } = {
          user_ids: uniqueIdsToPromote,
        };
        if (isDefault && password) {
          if (!isValidPassword(password)) {
            throw new Error("Invalid Password: Must be at least 4 digits.");
          }
          payload.password = password;
        }
        promises.push(axiosInstance.post("/promote/location-leader/", payload));
      }

      // Demotion API calls
      if (uniqueIdsToDemote.length > 0) {
        for (const userId of uniqueIdsToDemote) {
          promises.push(
            axiosInstance.post(`/depromote/location-leader/${userId}/`)
          );
        }
      }

      const results = await Promise.allSettled(promises);

      const fulfilledCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const rejectedCount = results.length - fulfilledCount;

      // Check if any rejected result has the default_loc error
      const hasDefaultLocError = results.some(
        (result) =>
          result.status === "rejected" &&
          result.reason?.response?.data?.password?.[0]?.includes("default_loc")
      );

      if (hasDefaultLocError) {
        hotToaster.error(
          "Leaders with 'default_loc' prefix should be promoted as default with password.",
          { duration: 4000 }
        );
      } else {
        showWarningToast(
          `Process Complete\n ${uniqueIdsToPromote.length} user(s) Promoted.\n
          ${uniqueIdsToDemote.length} user(s) Depromoted.\n
          ${rejectedCount > 0 ? `${rejectedCount} operation(s) failed.` : ""}`,
          rejectedCount > 0 ? "warning" : "success"
        );
      }
      // Reset state after completion
      setSelectedUser(null);
      setPassword("");
      setSearchTerm("");
      setIsDefault(false);
      setHasChanges(false);
      setShowPasswordDialog(false);
      fetchUsers(); // Refresh all data
    } catch (err: any) {
      const errorMessage = err.response?.data?.password?.[0] || err.message || "Could not process the request.";

      if (errorMessage.includes("default_loc")) {
        hotToaster.error(
          "Leaders with 'default_loc' prefix should be promoted as default with password.",
          { duration: 4000 }
        );
      } else {
        hotToaster.error(
          "An Unexpected Error Occurred\n" + errorMessage
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDepromote = async () => {
    if (!selectedLeaderToDepromote) return;
    try {
      await axiosInstance.post(
        `/depromote/location-leader/${selectedLeaderToDepromote.id}/`
      );
      hotToaster.success("Leader depromoted", {
        duration: 2000,
      });
      setSelectedLeaderToDepromote(null);
      setActiveMode("promote");
      fetchUsers();
    } catch (err) {
      hotToaster.error("Failed to depromote leader", {
        duration: 2000,
      });
    }
  };

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "md:pl-14"
        }`}
      >
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          onBack={() => router.push("/admin?tab=organization")}
        />

        <div className="flex flex-col gap-4 p-4 md:px-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {activeMode === "promote"
                  ? "Promote Location Leader"
                  : "Depromote Location Leader"}
              </h1>
            </div>
            {/* {activeMode === "promote" ? (
              <Button variant="destructive" onClick={() => setActiveMode("depromote")}>
                Depromote Location Leader
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setActiveMode("promote")}
                type="button"
              >
                Cancel Depromotion
              </Button>
            )} */}
          </div>

          {/* Promote UI */}
          {activeMode === "promote" && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">
                  Select User to Promote
                </h4>
                <div className="relative">
                  <Input
                    placeholder="Search and select user"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setLocationConflictMessage("");
                      setShowDropdown(true);
                      setSelectedUser(null);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    className="mb-2 pr-10"
                  />

                  {selectedUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchTerm("");
                        setLocationConflictMessage("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-800 hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  )}

                  {showDropdown && (
                    <div className="absolute z-10 w-full bg-white border rounded-md max-h-60 overflow-y-auto shadow-lg">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          onMouseDown={() => selectUser(user)}
                          className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                        >
                          {user.name} | {user.email} |{" "}
                          <span className="text-blue-900">
                            {user.locationname}
                          </span>{" "}
                          | {user.empid}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchTerm("");
                    }}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handlePromote()}
                    disabled={!canPromote || (selectedUser?.empid?.startsWith('default_loc') ?? false)}
                    type="button"
                  >
                    {isSubmitting ? "Promoting..." : "Promote"}
                  </Button>

                  <Button
                    onClick={() => {
                      setShowPasswordDialog(true);
                      setIsDefault(true);
                    }}
                    disabled={!selectedUser || !selectedUser.empid?.startsWith('default_loc') || hasChanges || isSubmitting}
                    type="button"
                  >
                    {isSubmitting ? "Promoting..." : "Promote as Default"}
                  </Button>
                </div>

                <Dialog
                  open={showPasswordDialog}
                  onOpenChange={setShowPasswordDialog}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enter Password</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="Enter password"
                      />
                      {error && <p className="text-red-500 text-sm">{error}</p>}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowPasswordDialog(false)}
                        type="button"
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!isValidPassword(password)}
                        onClick={() => {
                          handlePromote();
                        }}
                        type="button"
                      >
                        Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Depromote UI */}
          {activeMode === "depromote" && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">
                  Select Leader to Depromote
                </h4>
                <div className="relative mb-4">
                  <Input
                    placeholder="Search leader..."
                    value={selectedLeaderToDepromote?.name || ""}
                    onChange={() => setSelectedLeaderToDepromote(null)}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  />
                  {showDropdown && selectedLeaders.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-md max-h-60 overflow-y-auto shadow-lg">
                      {selectedLeaders.map((leader) => (
                        <div
                          key={leader.id}
                          onMouseDown={() => {
                            setSelectedLeaderToDepromote(leader);
                            setShowDropdown(false);
                          }}
                          className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                        >
                          {leader.name} | {leader.email} |{" "}
                          <span className="text-blue-900">
                            {leader.location}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    disabled={!selectedLeaderToDepromote}
                    onClick={handleDepromote}
                    type="button"
                  >
                    Depromote
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Leaders Table */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Location Leaders in this organization ({selectedLeaders.length})
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLeaderDetailsDialog(true)}
                >
                  View Location Leader Details
                </Button>
              </div>
              <div className="rounded-md border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-index">
                    <TableRow>
                      <TH></TH>
                      <TH>Location</TH>
                      <TH>Location Leaders</TH>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          <GlobalLoader />
                        </TableCell>
                      </TableRow>
                    ) : locations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          No Locations Found
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell>
                            <Input
                              type="radio"
                              name="selectedLocation"
                              value={location.name}
                              checked={selectedLocation === location.name}
                              onChange={() =>
                                setSelectedLocation(
                                  selectedLocation === location.name
                                    ? ""
                                    : location.name
                                )
                              }
                              className="h-4 w-4 cursor-pointer accent-blue-500"
                            />
                          </TableCell>

                          <TableCell>{location.name}</TableCell>
                          <TableCell>
                            {selectedLocation === location.name ? (
                              <div className="flex flex-col gap-3 items-center">
                                {/* Current assigned users */}
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {(usersByLocation[location.name] || []).map(
                                    (username, index) => (
                                      <div
                                        key={`${location.name}-${username}-${index}`}
                                        className="flex items-center bg-gray-100 rounded-full px-3 py-1"
                                      >
                                        <span className="text-sm">
                                          {username}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveUser(
                                              location.name,
                                              index
                                            )
                                          }
                                          className="ml-2 text-red-500 hover:text-red-700"
                                          title="Remove user"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* Select dropdown to add new user */}
                                <div className="flex items-center gap-2">
                                  <select
                                    className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    value=""
                                    onChange={(e) => {
                                      const selectedUser = e.target.value;
                                      if (!selectedUser) return;

                                      const updated = [
                                        ...(usersByLocation[location.name] ||
                                          []),
                                        selectedUser,
                                      ];

                                      setUsersByLocation((prev) => ({
                                        ...prev,
                                        [location.name]: updated,
                                      }));
                                      setHasChanges(true);
                                    }}
                                  >
                                    <option value="" hidden>
                                      Select user to add
                                    </option>
                                    {availableUsers
                                      .filter(
                                        (user) =>
                                          user.locationname
                                            ?.trim()
                                            .toLowerCase() ===
                                            location.name
                                              ?.trim()
                                              .toLowerCase() &&
                                          !(
                                            usersByLocation[location.name] || []
                                          ).includes(user.name) &&
                                          !user.empid?.startsWith('default_loc')
                                      )
                                      .map((user) => (
                                        <option key={user.id} value={user.name}>
                                          {user.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <span>
                                {(usersByLocation[location.name] || []).join(
                                  "; "
                                ) || "-"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={showLeaderDetailsDialog}
            onOpenChange={setShowLeaderDetailsDialog}
          >
            <DialogContent
              className="max-w-6xl"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>
                  All Location Leaders ({selectedLeaders.length})
                </DialogTitle>
              </DialogHeader>
              <div className="mb-2 w-full max-w-xs">
                <Input
                  placeholder="Search by first name, location, email, phone, password, employee ID"
                  value={leaderDetailsSearchTerm}
                  onChange={(e) => setLeaderDetailsSearchTerm(e.target.value)}
                />
              </div>
              <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-index">
                    <TableRow>
                      <TableHead>First Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Employee ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          <GlobalLoader />
                        </TableCell>
                      </TableRow>
                    ) : selectedLeaders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No Location Leaders Found
                        </TableCell>
                      </TableRow>
                    ) : filteredLeaderDetails.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No matching location leaders found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeaderDetails.map((leader) => {
                        const locationName =
                          locations.find((loc) => loc.id === leader.location)
                            ?.name || "-";
                        return (
                          <TableRow key={`leader-list-${leader.id}`}>
                            <TableCell>{leader.firstName || "-"}</TableCell>
                            <TableCell>{locationName}</TableCell>
                            <TableCell>{leader.email || "-"}</TableCell>
                            <TableCell>{leader.phone || "-"}</TableCell>
                            <TableCell>{leader.password || "-"}</TableCell>
                            <TableCell>{leader.empid || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
