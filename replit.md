# PDEReports MVP - Sistema de Relatórios NBR 15575

## Overview

PDEReports is a web application designed to automate the generation of Building Performance Profile (PDE) reports according to ABNT NBR 15575 standards. The system transforms a complex manual process that typically takes 40-80 hours into an efficient digital solution, reducing elaboration time by 70% and eliminating 95% of calculation errors.

The application serves civil engineers and architects who need to evaluate building performance across five critical criteria: structural safety, thermal performance, acoustic performance, water tightness, and fire safety. It provides standardized report generation with intuitive interfaces for both specialists and non-specialists.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built using React with TypeScript, utilizing a modern component-based architecture. The UI framework is based on shadcn/ui components with Radix UI primitives, providing a consistent and accessible design system. The styling is handled through Tailwind CSS with custom CSS variables for theming.

Key architectural decisions:
- **Routing**: Uses Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and data fetching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Component Library**: shadcn/ui components built on top of Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables

### Backend Architecture
The server follows a REST API architecture built with Express.js and TypeScript. The application uses a layered architecture pattern with clear separation between routes, storage, and business logic.

Key architectural decisions:
- **Framework**: Express.js for HTTP server and middleware handling
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints with consistent error handling and response formats
- **Storage Layer**: Abstracted storage interface for database operations
- **Authentication**: Replit Auth integration with session management

### Database Design
The database schema is designed around the core entities needed for building performance evaluation:
- **Users**: Authenticated user profiles with Replit Auth integration
- **Buildings**: Core building information including typology, location, and technical specifications
- **Building Systems**: Structural, sealing, and roofing system specifications
- **Performance Evaluations**: Calculated performance metrics and classifications
- **Reports**: Generated PDE reports with metadata

### Authentication and Security
The application implements Replit Auth for secure user authentication with session-based authentication using PostgreSQL session storage. Security features include:
- Token-based authentication with secure session management
- CSRF protection through proper session handling
- Input validation using Zod schemas at API boundaries
- Type safety across the entire application stack

### Performance Calculation Engine
The core business logic implements NBR 15575 calculations for building performance evaluation across five criteria. The calculation engine provides:
- Thermal performance calculations based on bioclimatic zones
- Structural safety assessments with design life calculations
- Acoustic performance evaluations with noise class considerations
- Water tightness scoring algorithms
- Fire safety compliance checking

## External Dependencies

### Database and Infrastructure
- **Neon Database**: PostgreSQL-compatible serverless database for data persistence
- **PostgreSQL**: Primary database engine with full ACID compliance
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Authentication and User Management
- **Replit Auth**: OAuth-based authentication system integrated with Replit platform
- **OpenID Connect**: Standard protocol for secure authentication flows

### Development and Build Tools
- **Vite**: Modern build tool and development server with hot module replacement
- **TypeScript**: Type safety across frontend and backend
- **Drizzle Kit**: Database migration and schema management tools
- **esbuild**: Fast JavaScript bundler for production builds

### UI and Styling
- **Radix UI**: Accessible, unstyled UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Utility for creating variant-based component APIs

### Data Management
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation for runtime type checking
- **date-fns**: Modern JavaScript date utility library

### Geographic Services
The application integrates with Brazilian postal code (CEP) lookup services for automatic address completion and bioclimatic zone determination based on geographic location.