"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import axiosInstance from "@/utils/axiosInstance"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"   // ✅ import icon
import hotToaster from "react-hot-toast";

interface DeleteFolderDialogProps {
    folderId: string
    folderName: string
}

export default function DeleteFolderDialog({ folderId, folderName }: DeleteFolderDialogProps) {
    const router = useRouter()

    const handleDelete = async () => {
        try {
            await axiosInstance.delete(`/folder/${folderId}/`)
            hotToaster.success(
              `The folder "${folderName}" has been deleted successfully.`
            );
            router.push("/forms")
        } catch (err) {
            console.error("Error deleting folder:", err)
            hotToaster.error(
              "Something went wrong while deleting the folder. Please try again."
            );
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    Delete Folder
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        Delete Folder
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this folder? This will permanently delete the folder{" "}
                        <span className="font-semibold">{folderName}</span>, but forms inside will remain safe.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={handleDelete}
                    >
                        Yes, Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
