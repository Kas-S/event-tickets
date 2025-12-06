# Product Overview

## Event Ticketing System

A serverless event management platform that enables event organizers to create and manage events while allowing attendees to discover, register, and receive digital tickets with QR codes.

## Core Features

- **User Management**: Email-based registration and authentication via AWS Cognito
- **Event Creation**: Organizers create events with details, cover photos, venue info, and capacity limits
- **Event Discovery**: Public browsing and searching of published events
- **Registration**: Attendees register for events and receive digital tickets via email
- **Digital Tickets**: QR code-based tickets for check-in verification
- **Capacity Management**: Automatic enforcement of event capacity limits
- **Organizer Dashboard**: View registered attendees and manage events
- **Notifications**: Email updates to attendees when event details change

## User Roles

- **Attendees**: Browse events, register, and receive digital tickets
- **Event Organizers**: Create/manage events, view attendee lists, send notifications

## Technical Approach

Fully serverless architecture on AWS designed to operate within Free Tier limits, using React for frontend and AWS CDK for infrastructure as code.
