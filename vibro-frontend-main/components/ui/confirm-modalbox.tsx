import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { AlertTriangle, XCircle, Info } from "lucide-react";
import React from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type?: "delete" | "deactivate" | "info" | "default";
  title?: string;
  variant?: "delete" | "deactivate" | "info" | "default";
  description?: string;
  button?: string;
  isLoading?: boolean,


}

const ConfirmModalBox: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  type = "default",
  title, variant, description, button, isLoading = false,


}) => {
  const getIcon = () => {
    const iconType = variant || type
    switch (iconType) {
      case "delete":
        return <AlertTriangle className="h-6 w-6 text-destructive" />
      case "deactivate":
        return <XCircle className="h-6 w-6 text-amber-500" />
      case "info":
      case "default":
      default:
        return <Info className="h-6 w-6 text-blue-500" />
    }
  }

  // const getButtonVariant = () => {
  //   if (confirmButtonVariant) return confirmButtonVariant

  //   const buttonType = variant || type
  //   switch (buttonType) {
  //     case "delete":
  //       return "destructive"
  //     case "deactivate":
  //       return "default"
  //     case "info":
  //     case "default":
  //     default:
  //       return "default"
  //   }
  // }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Trigger is optional if you're controlling with props */}
      <AlertDialogContent>
        <AlertDialogHeader >
          {/* {getIcon()} */}
          <AlertDialogTitle className="flex items-center gap-2">
            {getIcon()}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>



        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{button}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmModalBox;
