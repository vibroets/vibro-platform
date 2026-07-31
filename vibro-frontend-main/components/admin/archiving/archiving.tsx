import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";
import { FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ConfirmModalBox from "@/components/ui/confirm-modalbox";
import hotToaster from "react-hot-toast";

interface ArchivedItem {
  id: number;
  modal: "Organization" | "User" | "Group";
  organization_name?: string;
  organization_description?: string;
  name?: string;
  username?: string;
  email?: string;
  type?: string;
  allow_chat?: boolean;
  last_archived_date: string;
  status?: "Archived" | "Active";
  archivedBy: {
    id: number;
    username: string;
    email: string;
  };
}

export default function ArchivedItemsTab() {
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedValue, setSlectedValue] = useState<ArchivedItem | null>(null);
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchArchivedItems();
  }, []);

  const fetchArchivedItems = async () => {
    try {
      const res = await axiosInstance.get("/restore/list/archived");
      setArchivedItems(res.data);
    } catch (err) {
      console.error("Failed to fetch archived items", err);
    }
  };

  const handleRestore = async () => {
    if (!selectedValue) return;
    try {
      if (selectedValue?.modal === "Organization") {
        await axiosInstance.post("organizations/bulk-activate?activate=true", {
          organization_ids: [selectedValue?.id],
        });
      } else if (selectedValue?.modal === "User") {
        await axiosInstance.post(`/users/archive/${selectedValue?.id}?re-activate=true`);
      } else if (selectedValue?.modal === "Group") {
        await axiosInstance.post(`/groups/archive/${selectedValue?.id}?re-activate=true`);
      } else {
        return;
      }
      hotToaster.success(
        `${
          selectedValue?.modal
        } Restored\nThe ${selectedValue?.modal.toLowerCase()} has been successfully restored.`,
        { duration: 2000 }
      );
      fetchArchivedItems();
    } catch (err) {
      hotToaster.error(
        "Something went wrong while restoring. Please try again.",
        { duration: 2000 }
      );
    }
  };

  // Filtered archived items for search
  const filteredArchivedItems = archivedItems.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.modal.toLowerCase().includes(q) ||
      (item.organization_name && item.organization_name.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.username && item.username.toLowerCase().includes(q)) ||
      (item.archivedBy?.username && item.archivedBy.username.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <TabsContent value="archiving" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Archived Items</CardTitle>
            <CardDescription>
              Manage archived users, organizations, and groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-start mb-2">
              <div className="relative w-full">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-auto border border-gray-300 pl-8"
              />
              </div>
            </div>
             
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Archived On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchivedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No archived items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredArchivedItems.map((item) => (
                      <TableRow key={`${item.modal}-${item.id}`}>
                        <TableCell>
                          <div className="flex items-center">
                            <FileText className="mr-2 h-4 w-4" />
                            <Badge variant="outline">{item.modal}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.modal === "User" && item.username}
                          {item.modal === "Organization" &&
                            item.organization_name}
                          {item.modal === "Group" && item.name}
                        </TableCell>
                        <TableCell>
                          {new Date(item.last_archived_date).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Archived</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSlectedValue(item)
                              setShowModal(true)
                            }}
                          >
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <ConfirmModalBox
        isOpen={showModal}
        title="Activate Item"
        description="This will make the item active and available to users."
        variant="default"
        button={"Restore"}
        onClose={() => {
          setShowModal(false);
          setSlectedValue(null);
          // window.location.reload();
        }}
        onConfirm={() => {
          if (selectedValue) {
            // handleDeleteGroup(pendingDeleteId)
            handleRestore();
          }
        }}
      />
    </>
  );
}
