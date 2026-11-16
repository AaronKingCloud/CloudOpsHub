import AccountList from "../components/AccountList";
import PageHeader from "../components/layout/PageHeader";
import RefreshControl from "../components/RefreshControl";

function AccountsPage() {
  return (
    <>
      <PageHeader actions={<RefreshControl />} />
      <AccountList />
    </>
  );
}

export default AccountsPage;
