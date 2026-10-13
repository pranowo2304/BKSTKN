import React from 'react';
import { PersistentRoleFloatingDock, PersistentRoleFloatingDockProps } from './PersistentRoleFloatingDock';

export interface AdminFloatingDockProps extends PersistentRoleFloatingDockProps {}

export const AdminFloatingDock: React.FC<AdminFloatingDockProps> = (props) => {
  return <PersistentRoleFloatingDock {...props} isAdminRole={props.isAdminRole ?? true} />;
};

export default AdminFloatingDock;
