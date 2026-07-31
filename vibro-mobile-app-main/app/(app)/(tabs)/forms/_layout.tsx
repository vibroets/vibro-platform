import { Stack } from "expo-router/stack";
import React from "react";

export default function FormsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false, // Hide header for the initial screen
        }}
      />
      <Stack.Screen
        name="folder-list"
        options={{
          title: "FolderList",
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="multi-stage-form"
        options={{
          title: "Stage form",
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="task-close-questions"
        options={{
          title: "Task Close Questions",
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="bulk-assign-task"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="audit-bulk-assign-task"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
