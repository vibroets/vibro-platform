"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface ConditionalLogicModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasConditionalLogic: boolean;
  onToggleConditionalLogic: (enabled: boolean) => void;
  children?: React.ReactNode;
  isSaveDisabled?: boolean;
  onRemoveAllConditionalLogics?: () => void;
}

const ConditionalLogicModal: React.FC<ConditionalLogicModalProps> = ({
  open,
  onOpenChange,
  hasConditionalLogic,
  onToggleConditionalLogic,
  children,
  isSaveDisabled = false,
  onRemoveAllConditionalLogics,
}) => {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleDiscardClick = () => {
    setShowDiscardDialog(true);
  };

  const handleConfirmDiscard = () => {
    onRemoveAllConditionalLogics?.();
    onOpenChange(false);
    setShowDiscardDialog(false);
  };

  const handleCancelDiscard = () => {
    setShowDiscardDialog(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={`
        w-full
        max-w-lg
        sm:max-w-2xl
        md:max-w-3xl
        lg:max-w-4xl
        max-h-[80vh]
        overflow-y-auto
        rounded-lg
        p-0
        ${open ? "bg-gray-200" : "bg-white"}
        [&>button]:hidden
      `}
      style={{ padding: 0 }}
      onPointerDownOutside={(event) => event.preventDefault()}
    >
      
      <div className="flex flex-col h-full">
        <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between">
          <DialogTitle>Conditional Logic</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDiscardClick}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="space-y-4 pt-2 px-6 pb-2 flex-1 overflow-y-auto">
          {hasConditionalLogic ? (
            <div>{children}</div>
          ) : (
            <div className="text-gray-600 py-8 text-center">
              No conditional logic available.
            </div>
          )}
        </div>
        {hasConditionalLogic && (
          <DialogFooter className="px-6 pb-6">
            <Button
              variant="outline"
              className="w-auto text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition"
              onClick={() => onOpenChange(false)}
              disabled={isSaveDisabled}
            >
              Save
            </Button>
          </DialogFooter>
        )}
        {!hasConditionalLogic && (
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" className="w-auto text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </div>
    </DialogContent>
  </Dialog>

  <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to discard the changes?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={handleCancelDiscard}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={handleConfirmDiscard}>Discard</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </>
  );
};

export default ConditionalLogicModal;
