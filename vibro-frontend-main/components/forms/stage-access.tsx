// components/StageAccessEditor.tsx

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckIcon, ChevronDownIcon, PencilIcon, Search, ShieldCloseIcon } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Checkbox from "@radix-ui/react-checkbox";
import type { Stage } from "./form-creator";
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input";

interface StageAccessEditorProps {
    currentStage: Stage | undefined;
    formType?: string; // Type of the form (e.g., "location", "standard", etc.)
    onStageUpdate: (field: keyof Stage, value: any) => void;
    allUsers: any[]; // List of all available users from API
    allGroups: any[]; // List of all available groups from API
    toggleStageUser: (userId: any) => void;
    toggleStageGroup: (groupId: any) => void;
    userPopoverOpen: boolean;
    setUserPopoverOpen: (open: boolean) => void;
    groupPopoverOpen: boolean;
    setGroupPopoverOpen: (open: boolean) => void;
    previousStages?: Stage[]; // List of previous stages for "previous_stage" access type
}

const StageAccessEditor: React.FC<StageAccessEditorProps> = ({
    currentStage,
    formType,
    onStageUpdate,
    allUsers,
    allGroups,
    toggleStageUser,
    toggleStageGroup,
    userPopoverOpen,
    setUserPopoverOpen,
    groupPopoverOpen,
    setGroupPopoverOpen,
    previousStages = [],
}) => {
    if (!currentStage) return null;
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const filteredUsers = allUsers.filter((user) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            user.first_name?.toLowerCase().includes(searchLower) ||
            user.last_name?.toLowerCase().includes(searchLower) ||
            `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.phone?.toLowerCase().includes(searchLower)
        );
    });


    // Display selected users' names
    interface User {
        id: string | number;
        first_name?: string;
        email?: string;
    }

    interface Group {
        id: string | number;
        name: string;
    }

    const selectedUserNames: string =
        currentStage.users && currentStage.users.length
            ? currentStage.users
                .map((userId: User["id"]) => (allUsers as User[]).find((u) => u.id === userId)?.first_name || "N/A")
                .filter((name: string) => name !== "N/A")
                .join(", ")
            : "";

    // Display selected groups' names
    interface SelectedGroup {
        id: string | number;
        name: string;
    }

    const selectedGroupNames: string =
        currentStage.groups && currentStage.groups.length
            ? currentStage.groups
                .map(
                    (groupId: SelectedGroup["id"]) =>
                        (allGroups as SelectedGroup[]).find((g) => g.id === groupId)?.name || "N/A"
                )
                .filter((name: string) => name !== "N/A")
                .join(", ")
            : "";

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium mt-5">Who should fill this stage?</h3>
            <hr />

            <div className="mb-4 flex ">
                <div className="flex-1">
                    <RadioGroup
                        value={currentStage.whoShouldFill || ""}
                        onValueChange={(value) => onStageUpdate("whoShouldFill", value)}
                    >
                        <div className="flex items-center mb-5 mt-5">
                            <RadioGroupItem value="user" id="whoFills-userorgroups" />
                            <Label htmlFor="whoFills-user" className="ml-2">
                                Specific Users or Groups
                            </Label>
                        </div>
                        {
                            formType === "location" &&
                            <div className="flex items-center mb-5">
                                <RadioGroupItem value="role" id="whoFills-roles" />
                                <Label htmlFor="whoFills-roles" className="ml-2">
                                    Specific Roles
                                </Label>
                            </div>}
                        <div className="flex items-center mb-5">
                            <RadioGroupItem value="previous_stage" id="whoFills-anyonewhocompleted" />
                            <Label htmlFor="whoFills-anyonewhocompleted" className="ml-2">
                                Anyone who has completed a previous stage of this form
                            </Label>
                        </div>
                        <div className="flex items-center mb-2">
                            <RadioGroupItem value="organization" id="whoFills-anyone" />
                            <Label htmlFor="whoFills-anyone" className="ml-2">
                                Anyone in the Organization
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="flex-1">
                    {currentStage.whoShouldFill === "user" && (
                        <div className="space-y-4">
                            {/* Users Multi-select Popover */}
                            <div className="w-full">
                                <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
                                    Users
                                </Label>
                                <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                    <Popover.Trigger asChild>
                                        <button
                                            id="user-multiselect"
                                            className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                                            type="button"
                                        >
                                            {selectedUserNames || "- Select Users -"}
                                            <ChevronDownIcon className="ml-2 h-4 w-4" />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Portal>
                                        <Popover.Content
                                            className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                                            align="start"
                                        >
                                            <div className="relative mb-2">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="search"
                                                    placeholder="Search by name, email, phone..."
                                                    className="w-full pl-8"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            {/* ✅ Filtered user list */}
                                            {filteredUsers.length === 0 ? (
                                                <div className="p-2 text-gray-500">No users found.</div>
                                            ) : (
                                                filteredUsers.map((user) => (
                                                    <label
                                                        key={user.id}
                                                        className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                                                    >
                                                        <Checkbox.Root
                                                            className="h-4 w-4 border rounded flex items-center justify-center"
                                                            checked={currentStage.users?.includes(user.id)}
                                                            onCheckedChange={() => toggleStageUser(user.id)}
                                                        >
                                                            <Checkbox.Indicator>
                                                                <CheckIcon className="h-3 w-3 text-green-600" />
                                                            </Checkbox.Indicator>
                                                        </Checkbox.Root>

                                                        <span>
                                                            {user.first_name || "NA"} {user.last_name || ""} -{" "}
                                                            {user.email || "No Email"} {user.phone ? `(${user.phone})` : ""}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                        </Popover.Content>
                                    </Popover.Portal>
                                </Popover.Root>
                            </div>

                            {/* Groups Multi-select Popover */}
                            <div className="w-full">
                                <Label htmlFor="group-multiselect" className="text-sm font-medium text-gray-700">
                                    Groups
                                </Label>
                                <Popover.Root open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                                    <Popover.Trigger asChild>
                                        <button
                                            id="group-multiselect"
                                            className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                                            type="button"
                                        >
                                            {selectedGroupNames || "- Select Groups -"}
                                            <ChevronDownIcon className="ml-2 h-4 w-4" />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Portal>
                                        <Popover.Content
                                            className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                                            align="start"
                                        >
                                            {allGroups.length === 0 && <div className="p-2 text-gray-500">No groups available.</div>}
                                            {allGroups.map((group) => (
                                                <label
                                                    key={group.id}
                                                    className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                                                >
                                                    <Checkbox.Root
                                                        className="h-4 w-4 border rounded flex items-center justify-center"
                                                        checked={currentStage.groups?.includes(group.id)}
                                                        onCheckedChange={() => toggleStageGroup(group.id)}
                                                    >
                                                        <Checkbox.Indicator>
                                                            <CheckIcon className="h-3 w-3 text-green-600" />
                                                        </Checkbox.Indicator>
                                                    </Checkbox.Root>
                                                    <span>{group.name}</span>
                                                </label>
                                            ))}
                                        </Popover.Content>
                                    </Popover.Portal>
                                </Popover.Root>
                            </div>
                        </div>
                    )}
                    {currentStage.whoShouldFill === "previous_stage" && (
                        <div className="w-full" style={{ marginTop: "1.5rem" }}>
                            <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
                                Previous Stage
                            </Label>
                            <Select
                                key={currentStage.allow_stage || "empty"}   // ✅ ADD THIS
                                value={currentStage.allow_stage || ""}
                                onValueChange={(value) => {
                                    onStageUpdate("allow_stage", value);
                                }}
                            >

                                <SelectTrigger id="folder" className="mt-1">
                                    <SelectValue placeholder="Select a Stage" />
                                </SelectTrigger>
                                <SelectContent className="overflow-y-auto max-h-60">
                                    {previousStages.map((stage) => (
                                       <SelectItem key={stage.id} value={String(stage.id)}>
                                            {stage.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {currentStage.whoShouldFill === "role" && (
                        <div className="w-full" style={{ marginTop: "1.5rem" }}>
                            <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
                                Roles
                            </Label>
                            <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                <Popover.Trigger asChild>
                                    <button
                                        id="user-multiselect"
                                        className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                                        type="button"
                                    >
                                        {selectedUserNames || "- Select Roles -"}
                                        <ChevronDownIcon className="ml-2 h-4 w-4" />
                                    </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                    <Popover.Content
                                        className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                                        align="start"
                                    >
                                        {allUsers.length === 0 && <div className="p-2 text-gray-500">No users available.</div>}
                                        {allUsers.map((user) => (
                                            <label
                                                key={user.id}
                                                className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                                            >
                                                <Checkbox.Root
                                                    className="h-4 w-4 border rounded flex items-center justify-center"
                                                    checked={currentStage.users?.includes(user.id)}
                                                    onCheckedChange={() => toggleStageUser(user.id)}
                                                >
                                                    <Checkbox.Indicator>
                                                        <CheckIcon className="h-3 w-3 text-green-600" />
                                                    </Checkbox.Indicator>
                                                </Checkbox.Root>
                                                <span>
                                                    {user.first_name || "NA"} - {user.email || "Email Not Available"}
                                                </span>
                                            </label>
                                        ))}
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </div>
                    )}
                    {currentStage.whoShouldFill === "organization" && (
                        <p className="text-md" style={{ marginTop: "2rem" }}>
                            Anyone in the organization can fill this stage. No specific user or group selection is required.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="requiresApproval" className="cursor-pointer">
                        This Stage Requires Approval
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Admin needs to approve the form to share
                    </p>
                </div>
                <Switch
                    id={`${currentStage.id}-requiresApproval`}
                    checked={currentStage.requiresApproval || false}
                    onCheckedChange={(checked) => onStageUpdate("requiresApproval", checked)} />
            </div>
            {
                currentStage.requiresApproval && (
                    <div className="mt-2">
                        <div className="flex items-center gap-2 text-black-600 mb-2">
                            <CheckIcon className="h-4 w-4 text-green-600 mr-2" />
                            Approval

                            <ShieldCloseIcon className="h-4 w-4 text-red-600 ml-2" />
                            Reject
                        </div>
                        <div>
                            <p className="text-md">Please sign below to approve</p>
                        </div>
                        <div className="border-2 border-dotted border-gray-400 rounded-md h-16 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition">

                            <div className="flex items-center gap-2 text-primary">
                                <PencilIcon className="h-4 w-4" />
                                <span className="text-sm font-medium">Signature</span>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="mt-4">
                <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                    Remarks (Optional)
                </Label>
                <textarea
                    id="remarks"
                    value={currentStage.remarks || ""}
                    onChange={(e) => onStageUpdate("remarks", e.target.value)}
                    className="mt-1 block w-full border rounded-md p-2 text-sm"
                    placeholder="Enter any remarks or notes for this stage"
                />
            </div>
        </div>
    );
};

export default StageAccessEditor;

function setSelectedUsers(arg0: (prev: any) => any) {
    throw new Error("Function not implemented.");
}
