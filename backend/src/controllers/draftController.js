"use strict";

const draftRepository = require("../repositories/draftRepository");

const draftController = {
    list: async (req, res) => {
        const rows = await draftRepository.listForUser(req.user.userId);
        res.status(200).json({
            drafts: rows.map((row) => ({
                channelId: Number(row.channelId),
                content: row.content,
                updatedAt: row.updatedAt,
            })),
        });
    },

    save: async (req, res) => {
        const content = req.body.content ?? "";
        if (!content.trim()) {
            await draftRepository.remove(req.user.userId, req.params.channelId);
            res.status(200).json({ draft: null });
            return;
        }

        await draftRepository.save(req.user.userId, req.params.channelId, content);
        res.status(200).json({ draft: { channelId: Number(req.params.channelId), content } });
    },
};

module.exports = draftController;
