---
title: Patent Management System
summary: PatentEase simplifies the traditionally cumbersome patent submission and management process. It provides an intuitive platform for seamless patent application submission, status tracking, and employs a sophisticated similarity checker powered by machine learning. 
technologies:
  - React Native
  - Expo Go
  - Supabase
---

## Problem Analysis

There's a complex patent submission process. Patent application processes are traditionally lengthy, repetitive, and user-unfriendly. There's also a lack of transparency. Applicants often have little insight into why their submissions were accepted or rejected.

## Technical Solution

PatentEase was developed as a comprehensive solution, featuring robust technologies and design considerations:

- **Authentication and Storage**: 
  - User authentication handled securely through Supabase Auth.
  - Object storage provided by Supabase for managing uploaded patent documents efficiently and securely.


- **Patent Similarity Checker**: 
  - Utilizes an API to retrieve existing patents from the government database.
  - Patents are then vector-encoded to facilitate similarity comparison.
  - User-submitted patents undergo the same encoding and are compared against the existing database.
  - Generates a similarity score, presenting the most similar patents to the user for easy reference and comparison.

![Use Case Diagram](images/use-case-diagram.png)

- **Interactive Dashboard**:
  - Real-time tracking and management of patent application statuses.
  - Easy-to-navigate interface displaying notifications, application details, and statuses.

![Dashboard Screenshot](images/dashboard-screenshot.png)

- **Customizable User Settings**:
  - Supports multiple languages and dark/light mode toggles, respecting user preferences and accessibility.
  - Privacy-focused features, including password management aligned with internal compliance requirements.

![Settings Page Screenshot](images/settings-page-screenshot.png)

### External API Integration

- Integrates the Intellectual Property Office of Singapore’s (IPOS) API for reliable retrieval of patent metadata and documents, enhancing accuracy and transparency in data handling.

### Mobile Application Development

- Mobile app developed using **React Native and Expo**, ensuring seamless compatibility across both **iOS** and **Android** platforms.
- Cross-platform development facilitated rapid and consistent user experience, irrespective of device.

### Software Engineering Practices

PatentEase employed robust and modern software engineering methodologies, including:

- **SOLID Principles**:
  - Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles, significantly enhancing maintainability and scalability.

- **Version Control**:
  - GitHub was utilized for collaborative development, ensuring streamlined tracking of changes and ease of integration.

- **Test-Driven Development (TDD)**:
  - Pre-defined test cases prior to development, ensuring stable and reliable functionality throughout the development lifecycle.

- **Comprehensive Documentation**:
  - Detailed code comments, updated UML diagrams, and structured documentation practices contributed significantly to long-term project sustainability.

![Class Diagram](images/class-diagram.png)
![Sequence Diagram](images/sequence-diagram.png)

### Conclusion

PatentEase successfully transforms patent management into an efficient, transparent, and user-centric process. By leveraging modern technologies such as Supabase for authentication and storage, advanced machine learning for similarity checking, and React Native with Expo for mobile application development, PatentEase exemplifies best practices in software engineering and practical innovation.


Write your **bold** text, add headers, `code snippets`, or images like:

![Feature screenshot](images/project1-screenshot.png)
