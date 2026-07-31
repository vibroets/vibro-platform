const stages = [
  {
    name: "Personal Information",
    order: 1,
    isStateEnable: true,
    questions: [
      {
        id: "name",
        question: "Full Name",
        question_type: "short_answer",
        input_type: "text",
        is_required: true,
        validation: {
          minLength: {
            value: 3,
            message: "Name must be at least 3 characters",
          },
        },
      },
      {
        id: "email",
        question: "Email Address",
        question_type: "short_answer",
        input_type: "text",
        is_required: true,
        validation: {
          pattern: {
            value: /^\S+@\S+$/i,
            message: "Enter a valid email address",
          },
        },
      },
    ],
  },
  {
    name: "Additional Details",
    order: 2,
    isStateEnable: false,
    questions: [
      {
        id: "bio",
        question: "About You",
        question_type: "long_answer",
        input_type: "textarea",
        is_required: true,
      },
    ],
  },
];

export default stages;
