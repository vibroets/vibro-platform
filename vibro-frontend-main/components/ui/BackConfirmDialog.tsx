// components/BackConfirmDialog.tsx
"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BackConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange?: (value: boolean) => void;
}

const BackConfirmDialog: React.FC<BackConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this page?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to go back? Unsaved changes will be lost.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Yes, Go Back</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackConfirmDialog;
