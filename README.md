# Product Marketplace — Server

A production-ready REST API for a product marketplace, built with **Express.js**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**. It powers authentication, catalog management, reviews, and order processing for the [Product Marketplace Client](../product-marketplace-client).

[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express.js-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Response Format](#response-format)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Author](#author)

---

## Overview

This backend exposes a modular, role-aware REST API for a marketplace domain: users register and log in, browse categories and products, leave reviews, and place orders. Every write operation is soft-deleted rather than physically removed, and every response follows a single consistent shape so the client never has to guess how to parse a result.

## Features

- 🔐 **JWT authentication** with bcrypt password hashing
- 👤 **Role-based access control** (`USER` / `ADMIN`)
- 🗂️ **Modular service architecture** — routes, controllers, services, and validation are cleanly separated per domain
- 🧩 **Five core resources** — Users, Categories, Products, Reviews, Orders — each with full CRUD
- ♻️ **Soft delete** on every model (`isDeleted`) instead of destructive deletes
- 🧮 **Prisma enums** for status fields (`ProductStatus`, `OrderStatus`, `ReviewStatus`, etc.)
- 🧱 **Consistent API envelope** (`{ success, message, data }`) across every endpoint
- 🛡️ **Centralized error handling** for Prisma, validation, auth, and unknown errors
- 🌐 **CORS-ready** for frontend integration

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JSON Web Tokens (JWT) + bcrypt |
| Validation | Zod |
| Config | dotenv |

## Project Structure

```
server/
├── prisma/
│   └── schema.prisma        # Data models, enums, relations
├── src/
│   ├── app.ts                # Express app + middleware wiring
│   ├── server.ts              # Entry point
│   ├── config/                # Environment configuration
│   ├── lib/                   # Prisma client instance
│   ├── middlewares/            # Auth, error, not-found handlers
│   ├── utils/                  # JWT, password hashing, response helpers
│   ├── routes/                 # One router per resource
│   └── services/
│       ├── auth/
│       ├── user/
│       ├── category/
│       ├── product/
│       ├── review/
│       └── order/
│           ├── *.controller.ts
│           ├── *.service.ts
│           └── *.validation.ts
├── .env.example
├── package.json
└── tsconfig.json
```

## Database Schema

| Model | Key fields | Notes |
|---|---|---|
| **User** | name, email, password, role | `UserRole`: `USER`, `ADMIN` |
| **Category** | name, description, status | `CategoryStatus`: `ACTIVE`, `INACTIVE` |
| **Product** | name, price, stock, status, categoryId | `ProductStatus`: `ACTIVE`, `INACTIVE`, `OUT_OF_STOCK` |
| **Review** | rating, comment, status, userId, productId | `ReviewStatus`: `PUBLISHED`, `HIDDEN` |
| **Order** | quantity, totalPrice, status, userId, productId | `OrderStatus`: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED` |

Every model includes `id`, `createdAt`, `updatedAt`, and `isDeleted`, and maps to a snake_case table via `@@map()`.

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or local Postgres)

### Installation

```bash
git clone https://github.com/Kz-Himel/product-marketplace-server.git
cd product-marketplace-server
npm install
```

### Database setup

```bash
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, etc. — see below

npx prisma generate
npx prisma migrate dev --name init
```

### Run the server

```bash
npm run dev
```

The API will be available at `http://localhost:5000/api` (or your configured `PORT`).

### Inspect the database

```bash
npx prisma studio
```

Opens a GUI at `http://localhost:5555` for browsing and editing records — useful for promoting the first user to `ADMIN`.

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs — keep this private |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`, `1h`) |
| `PORT` | Port the server listens on |
| `NODE_ENV` | `development` or `production` |

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled production build |
| `npx prisma migrate dev` | Apply schema changes to the database |
| `npx prisma studio` | Open the database GUI |
| `npx prisma generate` | Regenerate the Prisma Client |

## API Reference

Base URL: `/api` · All responses follow the [standard envelope](#response-format).

### Auth

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | Public |
| POST | `/auth/login` | Log in and receive a JWT | Public |

### Categories

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/categories` | List all active categories | Public |
| GET | `/categories/:id` | Get a category by id | Public |
| POST | `/categories` | Create a category | Admin |
| PATCH | `/categories/:id` | Update a category | Admin |
| DELETE | `/categories/:id` | Soft-delete a category | Admin |

### Products

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/products` | List all active products | Public |
| GET | `/products/:id` | Get a product (with category + reviews) | Public |
| POST | `/products` | Create a product | Admin |
| PATCH | `/products/:id` | Update a product | Admin |
| DELETE | `/products/:id` | Soft-delete a product | Admin |

### Reviews

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/reviews` | List all reviews | Public |
| GET | `/reviews/:id` | Get a review by id | Public |
| POST | `/reviews` | Create a review | Logged-in user |
| PATCH | `/reviews/:id` | Update a review | Owner or Admin |
| DELETE | `/reviews/:id` | Soft-delete a review | Owner or Admin |

### Orders

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/orders` | List own orders (all orders for Admin) | Logged-in user |
| GET | `/orders/:id` | Get an order by id | Owner or Admin |
| POST | `/orders` | Place an order (validates stock, computes total) | Logged-in user |
| PATCH | `/orders/:id` | Update status (users may only cancel a `PENDING` order) | Owner or Admin |
| DELETE | `/orders/:id` | Soft-delete an order | Admin |

### Users

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/users` | List all users | Admin |
| POST | `/users` | Create a user | Admin |
| GET | `/users/:id` | Get a user by id | Logged-in user |
| PATCH | `/users/:id` | Update a user | Logged-in user |
| DELETE | `/users/:id` | Soft-delete a user | Admin |

## Response Format

**Success**

```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {}
}
```

**Error**

```json
{
  "success": false,
  "message": "Product not found",
  "error": { "details": [] }
}
```

## Authentication

1. Register via `POST /auth/register` or log in via `POST /auth/login`.
2. The response includes a JWT — store it client-side.
3. Send it on every protected request:

```
Authorization: Bearer <token>
```

The token payload carries `userId`, `email`, and `role`, which the auth middleware uses to enforce ownership and admin-only rules.

## Deployment

1. Push the repository to GitHub.
2. Create a new Web Service on [Render](https://render.com) (or your host of choice) pointing at this repo.
3. Set the environment variables listed above in the host's dashboard.
4. Build command: `npm run build` · Start command: `npm start`.
5. Deploy, then verify with `GET /api/categories`.

**Live API URL:** `https://<your-service>.onrender.com/api`

## Author

Built by **Himel** ([@Kz-Himel](https://github.com/Kz-Himel)) as part of the SCIC-13 program.
