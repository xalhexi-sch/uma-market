"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiTeamLine,
  RiShieldUserLine,
  RiUserAddLine,
  RiDeleteBinLine,
  RiMailLine,
  RiTimeLine,
  RiAlertLine,
  RiInformationLine,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import {
  inviteBusinessStaffAction,
  removeBusinessMemberAction,
  revokeBusinessInvitationAction,
} from "@/platform/member-actions";
import type {
  BusinessMemberDetail,
  BusinessInvitationDetail,
} from "@/platform/member-queries";
import type { Business, BusinessRole } from "@/lib/types";

interface BusinessMembersClientProps {
  business: Business;
  role?: BusinessRole;
  isOwner: boolean;
  members: BusinessMemberDetail[];
  pendingInvitations: BusinessInvitationDetail[];
}

export function BusinessMembersClient({
  business,
  isOwner,
  members,
  pendingInvitations,
}: BusinessMembersClientProps) {
  const router = useRouter();

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, startInviteTransition] = useTransition();

  // Remove confirmation dialog state
  const [memberToRemove, setMemberToRemove] = useState<BusinessMemberDetail | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  // Revoke invitation state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const ownerCount = members.filter((m) => m.role === "OWNER").length;
  const staffCount = members.filter((m) => m.role === "STAFF").length;

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setInviteError(null);
    startInviteTransition(async () => {
      const res = await inviteBusinessStaffAction({ email: inviteEmail });
      if (res.success) {
        toast.success(res.message || "Staff member invited successfully.");
        setInviteOpen(false);
        setInviteEmail("");
        router.refresh();
      } else {
        setInviteError(res.error || "Failed to invite staff member.");
      }
    });
  }

  function handleRemoveMember() {
    if (!memberToRemove || isRemoving) return;

    setRemoveError(null);
    startRemoveTransition(async () => {
      const res = await removeBusinessMemberAction({ memberId: memberToRemove.id });
      if (res.success) {
        toast.success(res.message || "Staff member removed.");
        setMemberToRemove(null);
        router.refresh();
      } else {
        setRemoveError(res.error || "Failed to remove staff member.");
      }
    });
  }

  function handleRevokeInvitation(invitationId: string) {
    if (!invitationId || revokingId) return;

    setRevokingId(invitationId);
    startRemoveTransition(async () => {
      try {
        const res = await revokeBusinessInvitationAction({ invitationId });
        if (res.success) {
          toast.success("Invitation revoked.");
          router.refresh();
        } else {
          toast.error(res.error || "Failed to revoke invitation.");
        }
      } finally {
        setRevokingId(null);
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="business-members-container">
      {/* Metrics / Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card size="sm" className="p-0 gap-0">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-medium text-muted-foreground">Total Members</span>
            <p className="text-xl font-bold text-foreground mt-0.5">{members.length}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="p-0 gap-0">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-medium text-muted-foreground">Owners</span>
            <p className="text-xl font-bold text-foreground mt-0.5">{ownerCount}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="p-0 gap-0">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-medium text-muted-foreground">Staff Operators</span>
            <p className="text-xl font-bold text-foreground mt-0.5">{staffCount}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="p-0 gap-0">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-medium text-muted-foreground">Pending Invites</span>
            <p className="text-xl font-bold text-foreground mt-0.5">{pendingInvitations.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff View Guidance (when caller is STAFF) */}
      {!isOwner && (
        <Alert
          data-testid="staff-view-notice"
          className="border-border/80 bg-muted/20 text-muted-foreground"
        >
          <RiInformationLine className="size-4 text-primary" aria-hidden="true" />
          <AlertDescription className="text-xs">
            Staff View — Member invitations and removals are managed exclusively by the business owner.
          </AlertDescription>
        </Alert>
      )}

      {/* Active Members Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Active Team Members
            </h2>
            <p className="text-xs text-muted-foreground">
              People with access to operate orders, messages, and catalog for {business.name}.
            </p>
          </div>

          {isOwner && (
            <Button
              type="button"
              size="sm"
              data-testid="invite-staff-trigger"
              onClick={() => {
                setInviteError(null);
                setInviteOpen(true);
              }}
              className="gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <RiUserAddLine className="size-4" aria-hidden="true" />
              <span>Invite Staff</span>
            </Button>
          )}
        </div>

        {/* Member List */}
        <Card
          data-testid="members-list"
          className="p-0 gap-0 overflow-hidden shadow-2xs"
        >
          <div className="divide-y divide-border">
            {members.map((member) => {
              const displayName = member.fullName || member.businessName || "Team Member";
              const isOwnerRole = member.role === "OWNER";

              return (
                <div
                  key={member.id}
                  data-testid={`member-row-${member.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground font-semibold text-xs mt-0.5 sm:mt-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate" data-testid="member-name">
                          {displayName}
                        </span>
                        {member.isCurrentUser && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {member.email && (
                          <span className="truncate flex items-center gap-1" data-testid="member-email">
                            <RiMailLine className="size-3 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                            {member.email}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">•</span>
                        <span>Joined {new Date(member.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <Badge
                      data-testid={`member-role-${member.role.toLowerCase()}`}
                      variant={isOwnerRole ? "default" : "outline"}
                      className="text-[11px] font-semibold uppercase tracking-wider"
                    >
                      {isOwnerRole ? (
                        <span className="flex items-center gap-1">
                          <RiShieldUserLine className="size-3" aria-hidden="true" />
                          OWNER
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <RiTeamLine className="size-3" aria-hidden="true" />
                          STAFF
                        </span>
                      )}
                    </Badge>

                    {/* Remove Button (Owner-only, only for STAFF) */}
                    {isOwner && !isOwnerRole && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`remove-member-btn-${member.id}`}
                        onClick={() => {
                          setRemoveError(null);
                          setMemberToRemove(member);
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5 text-xs gap-1 cursor-pointer"
                      >
                        <RiDeleteBinLine className="size-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Pending Invitations Section (Owner-only) */}
      {isOwner && pendingInvitations.length > 0 && (
        <section className="space-y-3 pt-4" data-testid="pending-invitations-section">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Pending Invitations ({pendingInvitations.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Sent invites waiting for staff members to create or link their accounts.
            </p>
          </div>

          <Card className="p-0 gap-0 overflow-hidden shadow-2xs">
            <div className="divide-y divide-border">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  data-testid={`pending-invitation-${inv.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <RiTimeLine className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {inv.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Sent {new Date(inv.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} • Role: {inv.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <Badge variant="secondary" className="text-[10px] text-amber-600 dark:text-amber-400">
                      Pending
                    </Badge>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid={`revoke-invitation-btn-${inv.id}`}
                      disabled={revokingId === inv.id}
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs cursor-pointer"
                    >
                      {revokingId === inv.id ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        "Revoke"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Invite Staff Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md" data-testid="invite-staff-dialog">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>
              Grant staff access to operate {business.name}. Staff members can view catalog, manage stock, and assist with orders without owner settings control.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4 pt-1">
            {inviteError && (
              <Alert
                variant="destructive"
                data-testid="invite-staff-error"
                className="p-2.5 text-xs border-destructive/30 bg-destructive/10"
              >
                <RiAlertLine className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                <AlertDescription className="text-xs text-destructive">
                  {inviteError}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="invite-staff-email"
                className="text-xs font-semibold text-foreground"
              >
                Teammate Email Address
              </label>
              <Input
                id="invite-staff-email"
                type="email"
                data-testid="invite-staff-email-input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                disabled={isInviting}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Assigned Role: <span className="font-semibold text-foreground">STAFF</span> (Fixed)
              </p>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteOpen(false)}
                disabled={isInviting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                data-testid="submit-invite-staff-btn"
                disabled={!inviteEmail.trim() || isInviting}
              >
                {isInviting ? (
                  <>
                    <Spinner className="mr-1.5 size-3.5" />
                    Inviting...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent className="sm:max-w-md" data-testid="remove-member-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">
                {memberToRemove?.fullName || memberToRemove?.email || "this staff member"}
              </span>{" "}
              from {business.name}? They will immediately lose access to this business workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {removeError && (
            <Alert
              variant="destructive"
              data-testid="remove-member-error"
              className="p-2.5 text-xs border-destructive/30 bg-destructive/10"
            >
              <RiAlertLine className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              <AlertDescription className="text-xs text-destructive">
                {removeError}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              disabled={isRemoving}
              onClick={() => setMemberToRemove(null)}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              data-testid="confirm-remove-member-btn"
              disabled={isRemoving}
              onClick={handleRemoveMember}
            >
              {isRemoving ? (
                <>
                  <Spinner className="mr-1.5 size-3.5" />
                  Removing...
                </>
              ) : (
                "Remove Staff Member"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
