import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
    region: "us-east-1",
    endpoint: `${process.env.S3_URL}:${process.env.S3_PORT}`,
    credentials: {
        accessKeyId: process.env.S3_KEY,
        secretAccessKey: process.env.S3_SECRET,
    },
    forcePathStyle: true,
});
