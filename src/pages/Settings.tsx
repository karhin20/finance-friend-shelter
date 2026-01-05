import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LogOut, User, KeyRound, Bell, FileText, Shield, AlertTriangle, List, Tag, PlusCircle, Trash2, Edit, Repeat } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { Category } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { useCurrency, CURRENCIES } from '@/contexts/CurrencyContext';
import { Globe } from 'lucide-react';

const SettingsPage = () => {
  const { user, signOut, deleteAccount } = useAuth();
  const { categoriesQuery, addCategoryMutation, addDefaultCategoriesMutation, deleteCategoryMutation, updateCategoryMutation } = useFinance();
  const { data: categories = [], isLoading: isLoadingCategories } = categoriesQuery;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

  // Load user data
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
    }
  }, [user]);

  // Filter categories by type for display
  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  // Update email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Simple email validation
    if (!email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: email,
      });

      if (error) throw error;

      toast({
        title: 'Email update requested',
        description: 'Check your new email inbox to confirm the change.',
      });
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Password validation
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both password fields match.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Reset password fields
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed.',
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle notification preferences
  const handleNotificationChange = (type: 'email' | 'weekly', value: boolean) => {
    if (type === 'email') {
      setEmailNotifications(value);
    } else {
      setWeeklyReports(value);
    }

    toast({
      title: 'Notification settings updated',
      description: 'Your notification preferences have been saved.',
    });
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!user) return;

    if (deleteConfirmText !== 'delete my account') {
      toast({
        title: 'Confirmation text does not match',
        description: 'Please type "delete my account" to confirm deletion.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
    }
  };

  // Add a wrapper for sign out to handle errors locally
  const handleSignOutAll = async () => {
    setLoading(true); // Optionally indicate loading state
    try {
      await signOut();
      toast({
        title: 'Signed Out',
        description: 'You have been signed out from all sessions.',
      });
      // No need to manually clear state here, AuthContext listener handles it
    } catch (error: any) {
      // Error is already logged in AuthContext's signOut
      toast({
        title: 'Sign Out Failed',
        description: error.message || 'Could not sign out from all devices. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  // --- Handler for Adding Category ---
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    addCategoryMutation.mutate({ name: trimmedName, type: newCategoryType }, {
      onSuccess: () => {
        setNewCategoryName(''); // Reset form on success
        // Type reset is optional, maybe keep last selected
      },
      // onError is handled by context toast
    });
  };

  // --- Handlers for Deleting Category ---
  const openDeleteCategoryDialog = (category: Category) => {
    console.log('openDeleteCategoryDialog called with:', category);
    setCategoryToDelete(category);
    setDeleteCategoryDialogOpen(true);
    console.log('State set - categoryToDelete:', category, 'deleteCategoryDialogOpen:', true);
  };

  const handleDeleteCategory = () => {
    if (!categoryToDelete) return;

    deleteCategoryMutation.mutate(categoryToDelete.id, {
      onSuccess: () => {
        setDeleteCategoryDialogOpen(false); // Close dialog on success
        setCategoryToDelete(null);
        // Toast is handled by context
      },
      onError: () => {
        // Keep dialog open on error? Optional.
        // Toast is handled by context
        // setDeleteCategoryDialogOpen(false); // Optionally close even on error
        // setCategoryToDelete(null);
      }
    });
  };
  // --- End Delete Handlers ---

  // --- Handlers for Editing Category ---
  const openEditCategoryDialog = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name); // Pre-fill with current name
    setEditCategoryDialogOpen(true);
  };

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim() || editCategoryName.trim() === editingCategory.name) {
      setEditCategoryDialogOpen(false); // Just close if no change or empty
      return;
    };

    updateCategoryMutation.mutate({
      id: editingCategory.id,
      updates: { name: editCategoryName.trim() }
    }, {
      onSuccess: () => {
        setEditCategoryDialogOpen(false);
        setEditingCategory(null);
        // Context handles toast & invalidation
      },
      onError: () => {
        // Keep dialog open on error?
      }
    });
  };
  // --- End Edit Handlers ---

  return (
    <DashboardLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* --- Link to Recurring Management --- */}
        <Card>
          <CardHeader>
            <CardTitle>Recurring Transactions</CardTitle>
            <CardDescription>Manage your scheduled recurring income and expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/recurring">
              <Button variant="outline">
                <Repeat className="mr-2 h-4 w-4" />
                Manage Recurring Rules
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Settings Tabs - Set defaultValue and reorder TabsList */}
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          {/* === Categories Settings Tab (Now first content) === */}
          <TabsContent value="categories" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    <CardTitle>Add New Category</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  Add custom categories for income or expenses.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleAddCategory}>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-grow space-y-2">
                      <Label htmlFor="category-name">Category Name</Label>
                      <Input
                        id="category-name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., Side Hustle, Groceries"
                        required
                        disabled={addCategoryMutation.isLoading}
                      />
                    </div>
                    <div className="w-full sm:w-[150px] space-y-2">
                      <Label htmlFor="category-type">Type</Label>
                      <Select
                        value={newCategoryType}
                        onValueChange={(value: 'income' | 'expense') => setNewCategoryType(value)}
                        required
                        disabled={addCategoryMutation.isLoading}
                      >
                        <SelectTrigger id="category-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-auto">
                      <Button type="submit" disabled={addCategoryMutation.isLoading || !newCategoryName.trim()} className="w-full sm:w-auto h-10">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        {addCategoryMutation.isLoading ? "Adding..." : "Add Category"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </form>
            </Card>

            {/* Display Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income Categories */}
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <List className="h-5 w-5 text-income" />
                    <CardTitle>Income Categories</CardTitle>
                  </div>
                  <CardDescription>Your custom income sources.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto">
                  {isLoadingCategories ? (<p>Loading categories...</p>)
                    : incomeCategories.length === 0 ? (<p className="text-muted-foreground">No custom income categories added yet.</p>)
                      : (
                        <ul className="space-y-2">
                          {incomeCategories.map(cat => (
                            <li key={cat.id} className="flex justify-between items-center gap-2 text-sm p-2 border rounded-md hover:bg-muted/50">
                              <span className="flex-grow break-words pr-1">{cat.name}</span>
                              <div className="flex items-center flex-shrink-0">
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={() => openEditCategoryDialog(cat)}
                                  disabled={updateCategoryMutation.isLoading || deleteCategoryMutation.isLoading}
                                  title="Edit Category"
                                > <Edit className="h-4 w-4" /> </Button >
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => openDeleteCategoryDialog(cat)}
                                  disabled={updateCategoryMutation.isLoading || deleteCategoryMutation.isLoading}
                                  title="Delete Category"
                                > <Trash2 className="h-4 w-4" /> </Button >
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                </CardContent>
              </Card>

              {/* Expense Categories */}
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <List className="h-5 w-5 text-expense" />
                    <CardTitle>Expense Categories</CardTitle>
                  </div>
                  <CardDescription>Your custom spending types.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto">
                  {isLoadingCategories ? (<p>Loading categories...</p>)
                    : expenseCategories.length === 0 ? (<p className="text-muted-foreground">No custom expense categories added yet.</p>)
                      : (
                        <ul className="space-y-2">
                          {expenseCategories.map(cat => (
                            <li key={cat.id} className="flex justify-between items-center gap-2 text-sm p-2 border rounded-md hover:bg-muted/50">
                              <span className="flex-grow break-words pr-1">{cat.name}</span>
                              <div className="flex items-center flex-shrink-0">
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={() => openEditCategoryDialog(cat)}
                                  disabled={updateCategoryMutation.isLoading || deleteCategoryMutation.isLoading}
                                  title="Edit Category"
                                > <Edit className="h-4 w-4" /> </Button >
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => openDeleteCategoryDialog(cat)}
                                  disabled={updateCategoryMutation.isLoading || deleteCategoryMutation.isLoading}
                                  title="Delete Category"
                                > <Trash2 className="h-4 w-4" /> </Button >
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/* === End Categories Settings Tab === */}

          {/* Account Settings */}
          <TabsContent value="account" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Account Information</CardTitle>
                </div>
                <CardDescription>
                  Update your account details
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateEmail}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      This email will be used for important notifications
                    </p>
                  </div>

                  <Alert className="bg-muted">
                    <AlertDescription>
                      Changing your email will require verification through the new email address.
                    </AlertDescription>
                  </Alert>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || email === user?.email}>
                    {loading ? "Updating..." : "Update Email"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>Export Data</CardTitle>
                </div>
                <CardDescription>
                  Download your financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Export all your financial records as CSV or JSON files for backup or analysis in other applications.
                </p>
              </CardContent>
              <CardFooter className="flex gap-4">
                <Button variant="outline">
                  Export as CSV
                </Button>
                <Button variant="outline">
                  Export as JSON
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Preferences Settings */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle>Regional Settings</CardTitle>
                </div>
                <CardDescription>
                  Customize your regional preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency.code} onValueChange={(code) => {
                    const selected = CURRENCIES.find(c => c.code === code);
                    if (selected) setCurrency(selected);
                  }}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="font-bold w-6 inline-block">{c.symbol}</span> {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    This will update the currency symbol displayed across the application.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <CardTitle>Password</CardTitle>
                </div>
                <CardDescription>
                  Update your password
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdatePassword}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Alert className="bg-muted">
                    <AlertDescription>
                      Choose a strong password that's at least 6 characters long with a mix of letters, numbers, and symbols.
                    </AlertDescription>
                  </Alert>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || !newPassword || !confirmPassword}>
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Session Management</CardTitle>
                </div>
                <CardDescription>
                  Manage your active sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Sign out from all devices to secure your account if you suspect unauthorized access.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={handleSignOutAll} className="flex items-center gap-2" disabled={loading}>
                  <LogOut className="h-4 w-4" />
                  {loading ? "Signing out..." : "Sign out from all devices"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>Notification Preferences</CardTitle>
                </div>
                <CardDescription>
                  Control how we communicate with you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive important account updates and alerts
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-reports">Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Get a weekly summary of your financial activity
                    </p>
                  </div>
                  <Switch
                    id="weekly-reports"
                    checked={weeklyReports}
                    onCheckedChange={(checked) => handleNotificationChange('weekly', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bill Reminders</CardTitle>
                <CardDescription>Never miss a payment deadline</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Form to add new bill reminders with name, amount, and due date */}
                {/* List of upcoming bills */}
                {/* Option to mark bills as paid */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger Zone */}
          <TabsContent value="danger" className="space-y-6">
            <Card className="shadow-sm border-destructive/50">
              <CardHeader className="text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle>Danger Zone</CardTitle>
                </div>
                <CardDescription className="text-destructive/80">
                  Irreversible account actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Deleting your account will permanently remove all your data and cannot be undone.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      Delete Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                      <DialogDescription>
                        This action is permanent and cannot be undone. All your data will be permanently removed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          You will lose all your financial data, including income and expense records.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-delete">
                          Type <span className="font-semibold">delete my account</span> to confirm
                        </Label>
                        <Input
                          id="confirm-delete"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="delete my account"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                        disabled={isDeletingAccount}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount || deleteConfirmText !== 'delete my account'}
                      >
                        {isDeletingAccount ? "Deleting..." : "Delete Account"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Category Confirmation Dialog (Ensure open/onOpenChange are correct) */}
      <Dialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Deleting this category will permanently remove all associated financial data.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-semibold">delete this category</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete this category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={deleteConfirmText !== 'delete this category'}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Edit Category Dialog === */}
      <Dialog open={editCategoryDialogOpen} onOpenChange={setEditCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Rename the category "{editingCategory?.name}". This will not affect existing transaction records.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCategory}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category-name" className="text-right">Name</Label>
                <Input
                  id="edit-category-name"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={updateCategoryMutation.isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button" // Important: prevent default form submission
                variant="outline"
                onClick={() => setEditCategoryDialogOpen(false)}
                disabled={updateCategoryMutation.isLoading}
              > Cancel </Button >
              <Button type="submit" disabled={updateCategoryMutation.isLoading || !editCategoryName.trim() || editCategoryName.trim() === editingCategory?.name}>
                {updateCategoryMutation.isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SettingsPage;
