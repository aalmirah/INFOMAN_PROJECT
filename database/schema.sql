SELECT
    u.full_name,
    u.email,
    r.right_name AS permission
FROM public.users u
JOIN public.userrights ur ON ur.user_id = u.user_id
JOIN public.rights r ON r.right_id = ur.right_id
ORDER BY u.user_id;