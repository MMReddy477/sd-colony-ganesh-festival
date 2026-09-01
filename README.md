# Ganesh Utsav Committee Website

Full-stack responsive committee portal using HTML5, CSS3, vanilla JavaScript, Bootstrap 5, Node.js, Express, MongoDB, JWT, bcrypt, PDFKit, ExcelJS, Multer, and Archiver.

## Run locally

1. Install Node.js 18+ and MongoDB, then copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run seed` to create the admin account.
4. Run `npm start` and open `http://localhost:5002`.

The default seed credentials are `admin` / `change-me-now`; set new values in `.env` before deployment.

## API

Public data is available at `GET /api/public`. Admin endpoints are JWT-protected under `/api`: `/members`, `/events`, `/gallery`, `/donations`, `/expenses`, `/receipts/:number`, and `/reports/:type/:format`.

## Deployment

### Render (permanent public URL)

1. Create a free MongoDB Atlas cluster, create a database user, allow `0.0.0.0/0` in Network Access, and copy the connection string.
2. Push this folder to GitHub, then choose **New > Blueprint** in Render and select the repository. Render reads `render.yaml` automatically.
3. Enter `MONGODB_URI`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` when prompted. Keep the generated `JWT_SECRET` and the `COMMITTEE_NAME` value.
4. After deployment, Render provides a URL like `https://sd-colony-ganesh-utsav.onrender.com`. Run `npm run seed` locally once with the same Atlas `MONGODB_URI`, or use a one-off Render shell, to create the admin account.

Render's free filesystem is temporary, so uploaded gallery files can disappear after a restart. Use a paid persistent disk mounted at `/opt/render/project/src/uploads`, or move image storage to Cloudinary/S3 for production.

### Vercel

Vercel is suitable for the static frontend, but this Express/MongoDB service should remain on Render or another Node host. For a single public URL, use the Render deployment above.

Production hardening includes Helmet headers, rate-limited login, JWT expiry, bcrypt hashing, Mongoose validation, image MIME/size limits, and no raw Mongo query operators accepted from user input.
