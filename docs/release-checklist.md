# Release checklist

## Pre-release

- [ ] CI is green on the exact commit to release.
- [ ] API type check, tests and production build pass.
- [ ] Desktop frontend build passes.
- [ ] Linux `.deb` build and `dpkg-deb` validation pass.
- [ ] Version is valid SemVer and synchronized across package metadata.
- [ ] Production API URL is HTTPS and points to the intended service.
- [ ] Update metadata/checksum behavior is verified.
- [ ] No secrets are present in the diff or artifact.
- [ ] Changelog is updated.

## Post-release

- [ ] Release artifact and checksum are present.
- [ ] API health check is responding.
- [ ] Desktop installation smoke test completed on supported Linux.
- [ ] Login/session smoke test completed.
- [ ] If a regression appears, stop rollout and follow rollback procedure.

A release must not be described as verified until the exact release commit has passed the required CI jobs and the runtime smoke test has been performed.
