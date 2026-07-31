import React from "react";
import AuditFormScreen from "../../../../components/form/screens/AudiFormScreen";

interface TodoAuditFormScreenProps {
  formId: string;
  taskId: string;
  submissionId?: string;
  draftId?: string;
  onClose: () => void;
}

const TodoAuditFormScreen: React.FC<TodoAuditFormScreenProps> = ({
  formId,
  taskId,
  submissionId,
  draftId,
  onClose,
}) => {
  return (
    <AuditFormScreen
      formId={formId}
      submissionId={submissionId}
      draftId={draftId}
      taskId={taskId}
      sourceScreen="todo"
      onClose={onClose}
    />
  );
};

export default TodoAuditFormScreen;
