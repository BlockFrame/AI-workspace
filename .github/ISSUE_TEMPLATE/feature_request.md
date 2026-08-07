name: Feature Request
description: Suggest an idea for AI Workspace
title: "[FEATURE] "
labels: ["enhancement"]

body:
  - type: markdown
    attributes:
      value: |
        Great idea! We'd love to hear your feature request. Please provide as much detail as possible.

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: |
        Describe the problem you're trying to solve or the gap you've noticed.
      placeholder: |
        Currently, I can only send prompts to one AI service at a time. It would be great if I could...
      validations:
        required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How would you like to see this feature implemented?
      placeholder: |
        I'd like to:
        1. Select multiple services
        2. Enter a prompt once
        3. Get results from all services side-by-side
      validations:
        required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Any alternative approaches or workarounds?
      placeholder: |
        Alternative 1: Copy/paste the prompt manually to each service (current workflow)
        Alternative 2: Browser extension to auto-populate forms

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I've searched existing issues for duplicates
          required: true
        - label: This feature would benefit other users, not just me
          required: false
        - label: I'm willing to help implement this feature
          required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Any screenshots, mockups, or other context?
      placeholder: "Drag and drop images, or paste links to examples of similar features."

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: How important is this feature to you?
      options:
        - "Nice to have"
        - "Important"
        - "Critical"
      default: 0
