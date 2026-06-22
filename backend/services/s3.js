import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://192.168.0.141:30320",
    credentials: {
        accessKeyId: process.env.S3_KEY,
        secretAccessKey: process.env.S3_SECRET,
    },
    forcePathStyle: true,
});
