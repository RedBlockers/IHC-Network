export default function AttachmentList({ attachments = [] }) {
    if (attachments.length === 0) return null;

    return (
        <ul className="attachments">
            {attachments.map((file) => (
                <li key={file.attachmentId} className={`attachment attachment-${file.kind}`}>
                    {file.kind === "image" && (
                        <a href={file.url} target="_blank" rel="noreferrer noopener">
                            <img src={file.url} alt={file.name} loading="lazy" />
                        </a>
                    )}
                    {file.kind === "video" && <video src={file.url} controls preload="metadata" />}
                    {file.kind === "audio" && <audio src={file.url} controls preload="metadata" />}

                    <a className="attachment-meta" href={file.url} download={file.name} target="_blank" rel="noreferrer noopener">
                        <strong>{file.name}</strong>
                        <small>
                            {file.size}
                            {file.version > 1 ? ` · version ${file.version}` : ""}
                            {file.path ? ` · ${file.path}` : ""}
                        </small>
                    </a>
                </li>
            ))}
        </ul>
    );
}
