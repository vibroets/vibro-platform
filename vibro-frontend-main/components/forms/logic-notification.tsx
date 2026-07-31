import React, { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, ChevronDownIcon } from "lucide-react";

type User = { id: string; first_name?: string; name?: string; email?: string };
type Group = { id: string; name?: string; description?: string };

interface LogicNotificationAccordionProps {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  users: User[];
  groups: Group[];
  selectedUsers: string[];
  setSelectedUsers: (users: string[]) => void;
  selectedGroups: string[];
  setSelectedGroups: (groups: string[]) => void;
  emails: string;
  setEmails: (emails: string) => void;
}

export const LogicNotificationAccordion: React.FC<LogicNotificationAccordionProps> = ({
  enabled,
  setEnabled,
  users,
  groups,
  selectedUsers,
  setSelectedUsers,
  selectedGroups,
  setSelectedGroups,
  emails,
  setEmails,
}) => {
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);

  const toggleUser = (id: string) => {
    setSelectedUsers(selectedUsers.includes(id)
      ? selectedUsers.filter(uid => uid !== id)
      : [...selectedUsers, id]);
  };
  const toggleGroup = (id: string) => {
    setSelectedGroups(selectedGroups.includes(id)
      ? selectedGroups.filter(gid => gid !== id)
      : [...selectedGroups, id]);
  };

  const selectedUserNames = users.filter(u => selectedUsers.includes(u.id)).map(u => u.first_name || u.name || "NA");
  const selectedGroupNames = groups.filter(g => selectedGroups.includes(g.id)).map(g => g.name || "NA");

  return (
    <Accordion type="single" collapsible className="w-full mb-4" defaultValue="">
      <AccordionItem value="notification">
        <AccordionTrigger>
          <span className="font-semibold">Notification</span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex items-center justify-between mb-4">
            <span>Send Notification</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {enabled && (
            <div className="space-y-4">
              {/* Users */}
              <div>
                <Label className="mb-1 block">Users</Label>
                <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                  <Popover.Trigger asChild>
                    <button
                      className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                    >
                      {selectedUserNames.length > 0
                        ? selectedUserNames.join(", ")
                        : "- Select Users -"}
                      <ChevronDownIcon className="ml-2 h-4 w-4" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                      align="start"
                    >
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                        >
                          <Checkbox.Root
                            className="h-4 w-4 border rounded flex items-center justify-center"
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => toggleUser(user.id)}
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
                  </Popover.Portal>
                </Popover.Root>
              </div>
              {/* Groups */}
              <div>
                <Label className="mb-1 block">Groups</Label>
                <Popover.Root open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                  <Popover.Trigger asChild>
                    <button
                      className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                    >
                      {selectedGroupNames.length > 0
                        ? selectedGroupNames.join(", ")
                        : "- Select Groups -"}
                      <ChevronDownIcon className="ml-2 h-4 w-4" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                      align="start"
                    >
                      {groups.map((group) => (
                        <label
                          key={group.id}
                          className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                        >
                          <Checkbox.Root
                            className="h-4 w-4 border rounded flex items-center justify-center"
                            checked={selectedGroups.includes(group.id)}
                            onCheckedChange={() => toggleGroup(group.id)}
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
                  </Popover.Portal>
                </Popover.Root>
              </div>
              {/* Emails */}
              <div>
                <Label className="mb-1 block">Emails</Label>
                <Input
                  placeholder="Enter comma-separated emails"
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">Separate multiple emails with commas.</span>
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};