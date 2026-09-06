import { useMemo } from "react";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import ContextMenu from "../ui/ContextMenu.jsx";
import useContextMenu from "../../hooks/useContextMenu.js";

function MemberRow({ member, onMemberAction, children }) {
    const menu = useContextMenu();

    const items = [
        { id: "profile", label: "Voir le profil", icon: "users", run: () => onMemberAction?.("profile", member) },
        { id: "mention", label: "Mentionner", icon: "hash", run: () => onMemberAction?.("mention", member) },
        { id: "message", label: "Envoyer un message privé", icon: "channels", run: () => onMemberAction?.("message", member) },
        { id: "copy", label: "Copier le pseudo", icon: "invite", run: () => navigator.clipboard?.writeText(`@${member.handle}`) },
    ];

    return (
        <li {...menu.triggerProps}>
            {menu.position && <ContextMenu items={items} position={menu.position} onClose={menu.close} />}
            {children}
        </li>
    );
}

const ORDER = { online: 0, idle: 1, dnd: 2, busy: 2, offline: 3 };
const roleClass = (m, ownerId) =>
    m.userId === ownerId ? "role-owner" : m.role === "admin" ? "role-admin" : "";

function MemberGroup({ label, list, ownerId, color, onMemberClick, onMemberAction }) {
    if (list.length === 0) return null;
    return (
        <section className="member-group">
            <h3 className="member-group-title">{label} — {list.length}</h3>
            <ul>
                {list.map((member) => (
                    <MemberRow key={member.userId} member={member} onMemberAction={onMemberAction}>
                    <button
                        className={`member ${roleClass(member, ownerId)}${!member.presence || member.presence === "offline" ? " offline" : ""}`}
                        style={color ? { "--role": color } : undefined}
                        onClick={(event) => onMemberClick?.(member, event)}
                    >
                        <Avatar user={member} size={34} presence={member.presence || "offline"} />
                        <span className="member-info">
                            <span className="member-name">
                                {member.displayName || member.handle}
                                {member.userId === ownerId && <span className="member-crown" title="Propriétaire"><Icon name="crown" size={13} /></span>}
                            </span>
                            {(member.activityText || member.aboutMe) && <span className="member-status">{member.activityText || member.aboutMe}</span>}
                        </span>
                    </button>
                    </MemberRow>
                ))}
            </ul>
        </section>
    );
}

export default function MemberList({ members, ownerId, onMemberClick, onMemberAction, onClose }) {
    const groups = useMemo(() => {
        const sorted = [...members].sort(
            (a, b) =>
                (ORDER[a.presence] ?? 3) - (ORDER[b.presence] ?? 3) ||
                (a.displayName || a.handle).localeCompare(b.displayName || b.handle)
        );
        const grouped = new Map();
        for (const member of sorted) {
            const highest = member.userId === ownerId
                ? { roleId: "owner", name: "Propriétaire", color: "#D9A441", position: 1000 }
                : member.roles?.filter((role) => !role.isDefault).sort((a, b) => b.position - a.position)[0]
                    ?? { roleId: member.role === "admin" ? "admin" : "member", name: member.role === "admin" ? "Administration" : "Membres", color: null, position: member.role === "admin" ? 900 : 0 };
            const current = grouped.get(highest.roleId) ?? { key: highest.roleId, label: `${highest.iconEmoji || ""} ${highest.name}`.trim(), color: highest.color, position: highest.position, members: [] };
            current.members.push(member);
            grouped.set(highest.roleId, current);
        }
        return [...grouped.values()].sort((a, b) => b.position - a.position);
    }, [members, ownerId]);

    const onlineCount = members.filter((member) => member.presence && member.presence !== "offline").length;

    return (
        <aside className="members members-context" aria-label="Membres">
            <header className="members-head">
                <div><strong>Membres</strong><span>{onlineCount} en ligne · {members.length}</span></div>
                <button onClick={onClose} aria-label="Fermer la liste des membres"><Icon name="close" size={17} /></button>
            </header>
            {groups.map((group) => (
                <MemberGroup key={group.key} label={group.label} list={group.members} ownerId={ownerId} color={group.color} onMemberClick={onMemberClick} onMemberAction={onMemberAction} />
            ))}
        </aside>
    );
}
