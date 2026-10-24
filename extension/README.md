# PomoGhost tab scare extension

Load this directory from `chrome://extensions` with **Developer mode** enabled,
then choose **Load unpacked**. On an ordinary webpage, click the PomoGhost
toolbar icon to authorise and show a full-viewport alert on that active tab.

The extension intentionally uses Chrome's temporary `activeTab` permission only:
it cannot monitor pages in the background or inject into restricted pages such
as `chrome://` pages, the Chrome Web Store, or browser UI. A production version
would need the user to explicitly grant site access plus a reviewed messaging
contract with a running PomoGhost session.
