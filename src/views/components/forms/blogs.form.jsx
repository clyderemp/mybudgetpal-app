import { useEffect, useState } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";
import { useFormUtils } from "@/utils/form.utils";
import { useAuth } from "@/context/auth.provider";
import { useFirebaseStorage } from "@/services/client/firebase-storage.service";
import { useBackendServices } from "@/services/server/backend.services";
import Loader from "../static/Loader";
import { useModal } from "@/context/modal.provider";

const BlogForm = ({ data = {}, onSuccess = () => {} }) => {
  const { user, blogs } = useAuth();
  const { closeModal } = useModal();

  const authorsFromBlogs =
    Array.from(
      new Map(
        blogs
          ?.map((b) => [b.author?.name, b.author])
          .filter(([name]) => !!name)
      ).values()
    ) || [];

  const authors = authorsFromBlogs.length > 0 ? authorsFromBlogs : [];

  const [blogData, setBlogData] = useState({
    thumbnail: null,
    title: "",
    date: new Date().toISOString(),
    content: "",
    author: {
      name: "",
      image: null,
    },
    ...data,
  });

  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [newAuthor, setNewAuthor] = useState({ name: "", image: null });
  const [isFormValid, setIsFormValid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?._id) {
      setBlogData((prev) => ({
        ...prev,
        ...data,
        author: { ...prev.author, ...data.author },
      }));
    }
  }, [data]);

  useEffect(() => {
    const validate = async () => {
      const valid = data?._id ? true : await useFormUtils.isFormComplete(blogData);
      setIsFormValid(valid && !isAddingAuthor);
    };
    validate();
  }, [blogData, isAddingAuthor]);

  const handleUpdateForm = async (key, value) => {
    await useFormUtils.updateData(key, value, setBlogData);
  };

  const handleAddAuthor = () => {
    if (newAuthor.name.trim()) {
      authors.push(newAuthor);
      setBlogData((prev) => ({ ...prev, author: newAuthor }));
      setIsAddingAuthor(false);
      setNewAuthor({ name: "", image: null });
    }
  };

  const isNewAuthorValid = newAuthor.name.trim() !== "";

  const AuthorPreview = ({ author }) => {
    if (!author?.name) return null;
    return (
      <div className="flex items-center space-x-3 mt-2">
        {author.image ? (
          <img
            src={
              typeof author.image === "string"
                ? author.image
                : URL.createObjectURL(author.image)
            }
            alt={author.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
            {author.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-medium">{author.name}</span>
      </div>
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let thumbnailUrl = blogData.thumbnail;
      let authorImageUrl = blogData.author?.image;

      if (blogData.thumbnail instanceof File) {
        const { url } = await useFirebaseStorage.uploadFile(
          `blogs/thumbnails/${blogData.title?.trim()}`,
          blogData.thumbnail
        );
        thumbnailUrl = url;
      }

      if (blogData.author?.image instanceof File) {
        const { url } = await useFirebaseStorage.uploadFile(
          `blogs/authors/${blogData.author.image.name?.trim()}`,
          blogData.author.image
        );
        authorImageUrl = url;
      }


      let response;
      if (data?._id) {
        response = await useBackendServices.update("blogs", data._id, blogData);
      } else {
        const finalData = {
          ...blogData,
          thumbnail: thumbnailUrl,
          author: {
            ...blogData.author,
            image: authorImageUrl,
          },
          uploadDate: new Date().toISOString(),
          adminID: user?.uid,
          visits: blogData.visits || [],
        };
        response = await useBackendServices.create("blogs", finalData);
      }

      console.log("Blog saved successfully:", response);
      if(response){
        closeModal();
        onSuccess?.();
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!data?._id) return;
    try {
      setLoading(true);
      await useBackendServices.delete("blogs", data._id);
      closeModal();
      onSuccess?.();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader text={data?._id ? 'Saving your changes' : 'Uploading blog'}/>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {data?._id ? "Edit Blog" : "Create New Blog"}
      </h2>

      <CustomInput
        type="image"
        value={blogData.thumbnail}
        onChange={(file) => handleUpdateForm("thumbnail", file)}
        placeholder="Upload Thumbnail"
      />

      <CustomInput
        type="text"
        value={blogData.title}
        autoCapitalize={true}
        onChange={(e) => handleUpdateForm("title", e.target.value)}
        placeholder="Blog Title"
      />

      <CustomInput
        type="date"
        value={blogData.date || new Date().toISOString()}
        onChange={(e) => handleUpdateForm("date", e.target.value)}
      />

      <CustomInput
        type="textarea"
        value={blogData.content}
        onChange={(e) => handleUpdateForm("content", e.target.value)}
        placeholder="Content"
      />

      <CustomInput
        type="dropdown"
        value={blogData.author?.name || ""}
        onChange={(e) => {
          if (e.target.value === "__add_new__") {
            setIsAddingAuthor(true);
          } else {
            const authorObj =
              authors.find((a) => a.name === e.target.value) || {
                name: "",
                image: null,
              };
            handleUpdateForm("author", authorObj);
          }
        }}
        options={[
          ...authors.map((a) => ({ label: a.name, value: a.name })),
          { label: "Add New Author", value: "__add_new__" },
        ]}
      />

      {!isAddingAuthor && <AuthorPreview author={blogData.author} />}

      {isAddingAuthor && (
        <div className="space-y-2 border p-2 rounded bg-gray-50">
          <CustomInput
            autoCapitalize={true}
            type="text"
            value={newAuthor.name}
            onChange={(e) =>
              setNewAuthor((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Author Name"
          />
          <CustomInput
            type="image"
            value={newAuthor.image}
            onChange={(file) =>
              setNewAuthor((prev) => ({ ...prev, image: file }))
            }
            placeholder="Upload Author Image"
          />
          <AuthorPreview author={newAuthor} />
          <CustomButton
            label={"Add Author"}
            isDisabled={!isNewAuthorValid}
            onClick={handleAddAuthor}
          />
        </div>
      )}

      {!isAddingAuthor && (
        <div className="flex space-x-2">
          <CustomButton
            label={data?._id ? "Save Changes" : "Create Blog"}
            isDisabled={!isFormValid}
            onClick={handleSubmit}
          />
          {data?._id && (
            <CustomButton label="Delete Blog" color="danger" onClick={handleDelete} />
          )}
        </div>
      )}
    </div>
  );
};

export default BlogForm;
