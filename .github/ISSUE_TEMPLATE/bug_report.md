name: Bug Report
description: Report a bug or unexpected behavior
title: "[BUG] "
labels: ["bug"]

body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the details below.

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: |
        Please provide your environment details:
      placeholder: |
        OS: Windows 11
        Node.js version: 18.17.0
        npm version: 9.6.4
        AI Workspace version: 1.0.0
      validations:
        required: true

  - type: textarea
    id: describe-bug
    attributes:
      label: Describe the Bug
      description: A clear and concise description of what the bug is.
      placeholder: When I try to... it does... instead of...
      validations:
        required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Open the app
        2. Click on ChatGPT account
        3. Try to send a broadcast
        4. Error occurs
      validations:
        required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should happen instead?
      placeholder: The broadcast should send the prompt to all selected services.
      validations:
        required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happens?
      placeholder: The app crashes and closes.
      validations:
        required: true

  - type: textarea
    id: logs
    attributes:
      label: Console/Error Output
      description: |
        If applicable, paste any error messages from:
        - Browser console (Ctrl+Shift+I)
        - Desktop error dialogs
        - Log files
      placeholder: "Error: Cannot read property 'sendPrompt' of undefined..."
      render: shell

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: If applicable, add screenshots or videos showing the bug.
      placeholder: Drag and drop images here.

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I've tested this on the latest version of AI Workspace
          required: true
        - label: I've searched existing issues for duplicates
          required: true
        - label: I've provided all requested information
          required: true

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Any other context about the problem?
      placeholder: "This bug also happens with Claude but not Gemini..."
