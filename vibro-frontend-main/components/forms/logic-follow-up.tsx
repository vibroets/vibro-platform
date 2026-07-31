"use client";

import React, { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, ChevronDownIcon, Plus, Trash } from "lucide-react";

import QuestionEditor from "./question-editor"; // <- adjust path if needed
import { Question, QuestionType } from "./form-creator";

type User = { id: string; first_name?: string; name?: string; email?: string };
type Group = { id: string; name?: string; description?: string };

type CloseQuestion = {
    question_uuid: string;
    question_type: QuestionType
    question: string;
    hint?: string;
    order: number;
    valueType?: "text" | "number";
    requiresLive?: boolean;
    maxFiles?: number;
    is_required: boolean;
    from?: number;
    to?: number;
    options?: string[];
};

interface LogicFollowUpAccordionProps {
    followup_toggle?: boolean;
    setFollowupToggle: (v: boolean) => void;
    title: string;
    setTitle: (t: string) => void;
    description: string;
    setDescription: (d: string) => void;
    deadline: number;
    setDeadline: (n: number) => void;
    users: User[];
    groups: Group[];
    allForms: any[];
    assign_form: string;
    setAssign_form: (v: string) => void;
    assignFormSubmitter: boolean;
    setAssignFormSubmitter: (v: boolean) => void;
    assignUsers: string[];
    setAssignUsers: React.Dispatch<React.SetStateAction<string[]>>;
    assignGroups: string[];
    setAssignGroups: React.Dispatch<React.SetStateAction<string[]>>;
    closeQuestions: CloseQuestion[];
    setCloseQuestions: React.Dispatch<React.SetStateAction<CloseQuestion[]>>;
    questionTypes: QuestionType[];
    questionTypesObj: { value: QuestionType; label: string }[];
    formId: number;
    stageId?: string;
    questionId: string;
    logicId: string | number;
    readOnlyAssignForm?: boolean;
}


const LogicFollowUpAccordion: React.FC<LogicFollowUpAccordionProps> = ({
    followup_toggle,
    setFollowupToggle,
    title,
    setTitle,
    description,
    setDescription,
    deadline,
    setDeadline,
    users,
    groups,
    allForms,
    assign_form,
    setAssign_form,
    assignFormSubmitter,
    setAssignFormSubmitter,
    assignUsers,
    setAssignUsers,
    assignGroups,
    setAssignGroups,
    closeQuestions,
    setCloseQuestions,
    questionTypes,
    questionTypesObj,
    formId,
    stageId,
    questionId,
    logicId,
    readOnlyAssignForm,
}) => {
    // Handlers for close questions
    const handleCloseQuestionUpdate = (
        _stageId: string,
        questionId: string,
        field: keyof Question,
        value: any
    ) => {
        setCloseQuestions((prev) =>
            prev.map((q) => {
                if (q.question_uuid === questionId) {
                    // Map QuestionEditor's "title" field to CloseQuestion's "question" field
                    const updatedField =
                        field === "title"
                            ? "question"
                            : field === "required"
                                ? "is_required"
                                : field === "type"
                                    ? "question_type"
                                    : field;
                    const updated = { ...q, [updatedField]: value };

                    // If question type changes to linear_scale, ensure min/max defaults exist and clear option labels
                    if (updatedField === "question_type" && value === "linear_scale") {
                        updated.from = updated.from ?? 1;
                        updated.to = updated.to ?? 5;
                        updated.options = ["", ""];
                    }

                    // If question type changes to multiple_choice, checkboxes, or dropdown, reset options
                    if (updatedField === "question_type" && ["multiple_choice", "checkboxes", "dropdown"].includes(value as string)) {
                        updated.options = ["", ""];
                    }

                    // If question type changes away from option-based types, clear options
                    if (updatedField === "question_type" && !["multiple_choice", "checkboxes", "dropdown", "linear_scale"].includes(value as string)) {
                        updated.options = undefined;
                    }

                    return updated;
                }
                return q;
            })
        );
    };
    const handleDeleteCloseQuestion = (id: string) => {
        setCloseQuestions((prev) => prev.filter((q) => q.question_uuid !== id));
    };
    const handleAddCloseQuestion = () => {
        setCloseQuestions((prev) => [
            ...prev,
            {
                question_uuid: `close-q${Date.now()}`,
                question_type: "short_answer",
                question: "",
                is_required: false,
                order: closeQuestions.length + 1,
                options: [],
            },
        ]);
    };



    // User/Group assignment helpers
    const toggleAssignUser = (id: string | number) => {
        const idStr = String(id);
        setAssignUsers((prev) =>
            prev.includes(idStr) ? prev.filter((uid) => uid !== idStr) : [...prev, idStr]
        );
    };
    const toggleAssignGroup = (id: string | number) => {
        const idStr = String(id);
        setAssignGroups((prev) =>
            prev.includes(idStr) ? prev.filter((gid) => gid !== idStr) : [...prev, idStr]
        );
    };

    const assignUserNames = users
        .filter((u) => assignUsers.some(id => String(id) === String(u.id)))
        .map((u) => u.first_name || u.name || "NA");
    const assignGroupNames = groups
        .filter((g) => assignGroups.some(id => String(id) === String(g.id)))
        .map((g) => g.name || "NA");

    const [open, setOpen] = useState(false);
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);
    const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchUserQuery, setSearchUserQuery] = useState("");
    const [searchGroupQuery, setSearchGroupQuery] = useState("");

    const assignFormTitle =
        assign_form
            ? allForms.find((form) => form.id.toString() === assign_form)?.title || assign_form
            : "";

    // const filteredForms = allForms.filter((form) =>
    //     form.title.toLowerCase().includes(searchQuery.toLowerCase())
    // );
    const filteredForms = Array.isArray(allForms)
        ? allForms.filter(
            (form) =>
                !form.is_archived && // only include non-archived forms
                form?.title?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        : [];
    const filteredUsers = Array.isArray(users)
        ? users.filter((user) => {
            const name = user.first_name || user.name || "";
            const email = user.email || "";
            const q = searchUserQuery.toLowerCase();
            return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
        })
        : [];
    const filteredGroups = Array.isArray(groups)
        ? groups.filter((group) => {
            const name = group.name || "";
            const desc = group.description || "";
            const q = searchGroupQuery.toLowerCase();
            return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
        })
        : [];
    
    return (
        <Accordion type="single" collapsible className="w-full mb-4" defaultValue={followup_toggle ? "followup" : ""}>
            <AccordionItem value="followup">
                <AccordionTrigger>
                    <span className="font-semibold">Follow-Up Actions</span>
                </AccordionTrigger>
                <AccordionContent>
                    {/* Enabled Switch */}
                    <div className="flex items-center justify-between mb-4">
                        <span>Create and assign when logic is triggered</span>
                        <Switch checked={followup_toggle ?? false} onCheckedChange={setFollowupToggle} />
                    </div>
                    {(followup_toggle ?? false) && (
                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <Label className="mb-1 block">Title *</Label>
                                <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            {/* Description */}
                            <div>
                                <Label className="mb-1 block">Description</Label>
                                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            {/* Deadline */}
                            <div>
                                <Label className="mb-1 block">Deadline*</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        value={deadline}
                                        onChange={(e) => setDeadline(Number(e.target.value))}
                                        className="w-20"
                                    />
                                    <span>day(s) after form submission at 11:59 PM</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    To set the deadline to be on the day of form submission, change the date to 0 days after.
                                </span>
                            </div>
                            {/* Assign Form with Search */}
                            <div>
                                <Label className="mb-1 block">Assign Form</Label>
                                {readOnlyAssignForm ? (
                                    <Input value={assignFormTitle || "-"} readOnly />
                                ) : (
                                    <Popover.Root open={open} onOpenChange={() => { }} modal>
                                        <Popover.Trigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={open}
                                                className="w-full justify-between"
                                                type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setOpen((prev) => !prev);
                                            }}
                                        >
                                                {assignFormTitle || "Select a form..."}
                                                <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </Popover.Trigger>
                                                <Popover.Content
                                                className="z-[9999] mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto overscroll-contain"
                                                align="start"
                                                onWheel={(e) => e.stopPropagation()}
                                                onTouchMove={(e) => e.stopPropagation()}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                        onInteractOutside={() => setOpen(false)}
                                        onEscapeKeyDown={() => setOpen(false)}
                                    >
                                                <div className="mb-2">
                                                    <input
                                                        type="text"
                                                    placeholder="Search forms..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full border rounded px-2 py-1 text-sm outline-none"
                                                />
                                                </div>
                                                {filteredForms.length === 0 && (
                                                    <div className="text-sm text-muted-foreground px-2 py-1">
                                                        No form found.
                                                    </div>
                                                )}
                                                {filteredForms.map((form) => {
                                                    const isSelected = String(form.id) === String(assign_form);
                                                    return (
                                                        <label
                                                            key={form.id}
                                                            className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                                                        >
                                                            <Checkbox.Root
                                                                className="h-4 w-4 border rounded flex items-center justify-center"
                                                                checked={isSelected}
                                                                onCheckedChange={() => {
                                                                    if (isSelected) {
                                                                        setAssign_form("");
                                                                    } else {
                                                                        setAssign_form(form.id.toString());
                                                                    }
                                                                }}
                                                            >
                                                                <Checkbox.Indicator>
                                                                    <CheckIcon className="h-3 w-3 text-green-600" />
                                                                </Checkbox.Indicator>
                                                            </Checkbox.Root>
                                                            <span>{form.title}</span>
                                                        </label>
                                                    );
                                                })}
                                        </Popover.Content>
                                        </Popover.Root>
                                )}
                            </div>
                            {/* Assign to Submitter */}
                            <div>
                                <Label className="mb-1 block">Who do you want this task to be assigned to?</Label>
                                <div className="flex items-center gap-2">
                                    <Checkbox.Root
                                        checked={assignFormSubmitter}
                                        onCheckedChange={setAssignFormSubmitter}
                                        id="assignFormSubmitter"
                                    >
                                        <Checkbox.Indicator>
                                            <CheckIcon className="h-3 w-3 text-green-600" />
                                        </Checkbox.Indicator>
                                    </Checkbox.Root>
                                    <Label htmlFor="assignFormSubmitter">Form Submitter</Label>
                                </div>
                            </div>
                            {/* Assign Users */}
                            <div>
                                <Label className="mb-1 block">Users</Label>
                                <Popover.Root open={userPopoverOpen} onOpenChange={() => { }} modal>
                                    <Popover.Trigger asChild>
                                        <button
                                            type="button"
                                            className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setUserPopoverOpen((prev) => !prev);
                                            }}
                                        >
                                            {assignUserNames.length > 0
                                                ? assignUserNames.join(", ")
                                                : assignUsers.length > 0
                                                    ? assignUsers.join(", ")
                                                    : "- Select Users -"}
                                            <ChevronDownIcon className="ml-2 h-4 w-4" />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Content
                                            className="z-[9999] mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto overscroll-contain"
                                            align="start"
                                            onWheel={(e) => e.stopPropagation()}
                                            onTouchMove={(e) => e.stopPropagation()}
                                            onOpenAutoFocus={(e) => e.preventDefault()}
                                            onInteractOutside={() => setUserPopoverOpen(false)}
                                            onEscapeKeyDown={() => setUserPopoverOpen(false)}
                                        >
                                            <div className="mb-2">
                                                <input
                                                    type="text"
                                                    placeholder="Search users..."
                                                    value={searchUserQuery}
                                                    onChange={(e) => setSearchUserQuery(e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm outline-none"
                                                />
                                            </div>
                                            {filteredUsers.length === 0 && (
                                                <div className="text-sm text-muted-foreground px-2 py-1">
                                                    No user found.
                                                </div>
                                            )}
                                            {filteredUsers.map((user) => (
                                                <label key={user.id} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer">
                                                    <Checkbox.Root
                                                        className="h-4 w-4 border rounded flex items-center justify-center"
                                                        checked={assignUsers.some(id => String(id) === String(user.id))}
                                                        onCheckedChange={() => toggleAssignUser(user.id)}
                                                    >
                                                        <Checkbox.Indicator>
                                                            <CheckIcon className="h-3 w-3 text-green-600" />
                                                        </Checkbox.Indicator>
                                                    </Checkbox.Root>
                                                    <span>
                                                        {user.first_name || user.name || "NA"} - {user.email || "Email Not Available"}
                                                    </span>
                                                </label>
                                            ))}
                                    </Popover.Content>
                                </Popover.Root>
                            </div>
                            {/* Assign Groups */}
                            <div>
                                <Label className="mb-1 block">Groups</Label>
                                <Popover.Root open={groupPopoverOpen} onOpenChange={() => { }} modal>
                                    <Popover.Trigger asChild>
                                        <button
                                            type="button"
                                            className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setGroupPopoverOpen((prev) => !prev);
                                            }}
                                        >
                                            {assignGroupNames.length > 0
                                                ? assignGroupNames.join(", ")
                                                : assignGroups.length > 0
                                                    ? assignGroups.join(", ")
                                                    : "- Select Groups -"}
                                            <ChevronDownIcon className="ml-2 h-4 w-4" />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Content
                                            className="z-[9999] mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto overscroll-contain"
                                            align="start"
                                            onWheel={(e) => e.stopPropagation()}
                                            onTouchMove={(e) => e.stopPropagation()}
                                            onOpenAutoFocus={(e) => e.preventDefault()}
                                            onInteractOutside={() => setGroupPopoverOpen(false)}
                                            onEscapeKeyDown={() => setGroupPopoverOpen(false)}
                                        >
                                            <div className="mb-2">
                                                <input
                                                    type="text"
                                                    placeholder="Search groups..."
                                                    value={searchGroupQuery}
                                                    onChange={(e) => setSearchGroupQuery(e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm outline-none"
                                                />
                                            </div>
                                            {filteredGroups.length === 0 && (
                                                <div className="text-sm text-muted-foreground px-2 py-1">
                                                    No group found.
                                                </div>
                                            )}
                                            {filteredGroups.map((group) => (
                                                <label key={group.id} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer">
                                                    <Checkbox.Root
                                                        className="h-4 w-4 border rounded flex items-center justify-center"
                                                        checked={assignGroups.some(id => String(id) === String(group.id))}
                                                        onCheckedChange={() => toggleAssignGroup(group.id)}
                                                    >
                                                        <Checkbox.Indicator>
                                                            <CheckIcon className="h-3 w-3 text-green-600" />
                                                        </Checkbox.Indicator>
                                                    </Checkbox.Root>
                                                    <span>
                                                        {group.name || "NA"} - {group.description || "NA"}
                                                    </span>
                                                </label>
                                            ))}
                                    </Popover.Content>
                                </Popover.Root>
                            </div>
                            {/* Questions to ask on closing task */}
                            <div>
                                <Label className="block font-medium mb-2">Questions to ask on closing task</Label>
                                {(Array.isArray(closeQuestions) ? closeQuestions : []).map((q, i) => (
                                    <div key={q.question_uuid} className="mb-4 border rounded px-3 py-3">
                                        {/* Show Question Type Label and Dropdown */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-medium text-sm">
                                                {questionTypesObj.find(t => t.value === q.question_type)?.label || q.question_type}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={q.question_type}
                                                    onValueChange={(type) => {
                                                        setCloseQuestions(prev =>
                                                            prev.map(qq =>
                                                                qq.question_uuid === q.question_uuid ? { ...qq, question_type: type as QuestionType } : qq
                                                            )
                                                        );
                                                    }}
                                                >
                                                    <SelectTrigger className="w-40">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {questionTypesObj.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {closeQuestions.length > 0 && (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => handleDeleteCloseQuestion(q.question_uuid)}
                                                        className="p-2 hover:bg-red-500 border-red-300 hover:text-white transition duration-100 ease-in-out"
                                                        size="icon"
                                                        aria-label="Remove question"
                                                        title="Remove question"
                                                
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <QuestionEditor
                                            validationError={false}
                                            validationErrors={{}}
                                            question={{
                                                ...q,
                                                id: q.question_uuid,
                                                type: q.question_type,
                                                title: q.question,
                                                required: q.is_required ?? false,
                                                options: (() => {
                                                    const opts = q.options ?? [];
                                                    const isDefaultNumeric5 =
                                                        Array.isArray(opts) &&
                                                        opts.length === 5 &&
                                                        opts.every((o, idx) => String(o) === String(idx + 1));

                                                    // For close questions, avoid showing the auto-generated 1-5 options by default
                                                    if (
                                                        isDefaultNumeric5 &&
                                                        ["multiple_choice", "checkboxes", "dropdown"].includes(q.question_type)
                                                    ) {
                                                        return [];
                                                    }

                                                    // For linear scale, show only the two label fields
                                                    if (isDefaultNumeric5 && q.question_type === "linear_scale") {
                                                        return ["", ""];
                                                    }

                                                    return opts;
                                                })(),
                                            }}
                                            questions={closeQuestions.map(q => ({
                                                ...q,
                                                id: q.question_uuid,
                                                type: q.question_type,
                                                title: q.question,
                                                required: q.is_required ?? false
                                            }))}
                                            stageId="close-task"
                                            questionTypes={questionTypes}
                                            questionTypesObj={questionTypesObj}
                                            handleQuestionUpdate={handleCloseQuestionUpdate}
                                            handleAddSubQuestion={() => { }}
                                            handleUpdateSubQuestion={() => { }}
                                            handleDeleteSubQuestion={() => { }}
                                            handleUpdateOption={() => { }}
                                            addOptionToParentQuestion={() => { }}
                                            addOptionToSubQuestion={() => { }}
                                            deleteOptionFromParentQuestion={() => { }}
                                            deleteOptionFromSubQuestion={() => { }}
                                            handleMoveQuestionUp={() => { }}
                                            handleMoveQuestionDown={() => { }}
                                            handleDuplicateQuestion={() => { }}
                                            handleDuplicateSubQuestion={() => { }}
                                            handleReorderOptions={() => { }}
                                            handleReorderAuditOptions={() => { }}
                                            MoveUpIcon={() => <></>}
                                            MoveDownIcon={() => <></>}
                                            CopyIcon={() => <></>}
                                            getQuestionTypeIcon={() => <></>}
                                        />
                                        {q.question_type !== "title_and_description" && (
                                            <div className="flex items-center justify-between mt-3">
                                                <Label htmlFor={`close-question-${q.question_uuid}-required`} className="cursor-pointer">
                                                    Required
                                                </Label>
                                                <Switch
                                                    id={`close-question-${q.question_uuid}-required`}
                                                    checked={q.is_required ?? false}
                                                    onCheckedChange={(checked) =>
                                                        handleCloseQuestionUpdate("close-task", q.question_uuid, "required", checked)
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    onClick={handleAddCloseQuestion}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Question
                                </Button>
                            </div>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export default LogicFollowUpAccordion;
