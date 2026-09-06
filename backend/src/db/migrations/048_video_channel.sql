ALTER TABLE channels
    MODIFY COLUMN type ENUM(
        'text','voice','announcement','forum','poll','event','ticket','task',
        'wiki','documentation','resources','faq','gallery','stage','support',
        'review','design','meeting','development','incident','ephemeral',
        'gated','spoiler','video'
    ) NOT NULL DEFAULT 'text';
